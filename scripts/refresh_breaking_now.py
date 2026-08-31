#!/usr/bin/env python3
"""Refresh Breaking/Local Update with strict freshness and why-now context.

Breaking News still uses the strict source threshold. Local Update prioritizes
fresh verified Burlington/Halton developments, then allows an existing Burlington
News story only when there is a real reason to surface it now: a related fresh
event, a meaningful update, an explicit editorial context signal, or an anniversary.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

import build_breaking_now as base
from editorial_policy import load_policy
from sources.hamilton_police import collect as hps_collect
from sources.score import breaking_score, passes_breaking_threshold, source_age_hours
from sources.verify import similar
from story_lifecycle import is_resolved, lifecycle_status

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TZ = ZoneInfo("America/Toronto")
OUT = DATA / "breaking-now.json"
QUEUE = DATA / "discovery-queue.json"
LOCAL_MAX_HOURS = 18.0
REGIONAL_MAX_HOURS = 24.0
FOLLOW_UP_MIN_SIMILARITY = 0.43
RELATED_STORY_MIN_SIMILARITY = 0.52
GENERIC_RELATION_WORDS = {
    "burlington", "halton", "ontario", "canada", "city", "local", "news",
    "public", "safety", "service", "road", "roads", "street", "police",
}


def load(name: str, fallback):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except Exception:
        return fallback


def clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_time(value) -> dt.datetime | None:
    raw = clean(value)
    if not raw:
        return None
    try:
        if len(raw) == 10 and raw[4] == "-":
            return dt.datetime.fromisoformat(raw).replace(hour=12, tzinfo=TZ)
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except ValueError:
        return None


def editorial_family(item: dict) -> str:
    value = " ".join(clean(item.get(key)).lower() for key in ("editorialFamily", "kind", "label", "category", "topic"))
    if re.search(r"home rules|permit|parking|bylaw|service", value):
        return "service"
    if re.search(r"public safety|police|crime|shooting|fire", value):
        return "public-safety"
    if re.search(r"traffic|transport|road|qew|collision", value):
        return "traffic"
    if re.search(r"history|mystery|heritage", value):
        return "history"
    if re.search(r"development|construction|housing", value):
        return "development"
    if re.search(r"food|restaurant|drink", value):
        return "food"
    if "sport" in value:
        return "sports"
    if re.search(r"event|festival", value):
        return "events"
    if re.search(r"school|education", value):
        return "schools"
    if re.search(r"election|council|politic", value):
        return "civic"
    return clean(item.get("topic") or item.get("category") or item.get("label") or item.get("id") or "other").lower()


def strict_diversify(items: list[dict], limit: int = 2) -> list[dict]:
    picked = []
    families = set()
    for item in items:
        family = editorial_family(item)
        if family in families:
            continue
        picked.append(item)
        families.add(family)
        if len(picked) >= limit:
            break
    return picked


def archive_follow_up(item: dict, archive: dict) -> tuple[dict | None, float]:
    """Find an older Burlington News story this fresh source item appears to update."""
    best = None
    best_score = 0.0
    item_age = source_age_hours(item)
    if item_age is None:
        return None, 0.0
    for story in archive.get("items") or []:
        probe = {
            "headline": story.get("headline") or "",
            "summary": story.get("deck") or story.get("summary") or "",
        }
        score = similar(item, probe)
        if score < FOLLOW_UP_MIN_SIMILARITY or score <= best_score:
            continue
        old_time = story.get("sourcePublishedAt") or story.get("lastMeaningfulUpdate") or story.get("publishedAt")
        if old_time:
            try:
                old_dt = dt.datetime.fromisoformat(str(old_time).replace("Z", "+00:00"))
                if old_dt.tzinfo is None:
                    old_dt = old_dt.replace(tzinfo=TZ)
                new_dt = dt.datetime.fromisoformat(str(item.get("updatedAt") or item.get("publishedAt")).replace("Z", "+00:00"))
                if new_dt.tzinfo is None:
                    new_dt = new_dt.replace(tzinfo=TZ)
                if new_dt <= old_dt + dt.timedelta(minutes=10):
                    continue
            except Exception:
                pass
        best = story
        best_score = score
    return best, best_score


def annotate_candidate(item: dict, archive: dict) -> dict:
    item = dict(item)
    item["lifecycleStatus"] = lifecycle_status(item)
    if is_resolved(item):
        item["status"] = "resolved"
        item["lastMeaningfulUpdate"] = (
            item.get("lastMeaningfulUpdate")
            or item.get("meaningfulUpdatedAt")
            or item.get("updatedAt")
            or item.get("publishedAt")
        )
    base.breaking_score(item)
    base.local_update_score(item)
    prior, match_score = archive_follow_up(item, archive)
    if prior:
        item["followUpUpdate"] = True
        item["followUpTo"] = prior.get("id") or prior.get("url")
        item["followUpSimilarity"] = round(match_score, 3)
        item["storyUrl"] = base.public_story_url(str(prior.get("url") or prior.get("storyUrl") or item.get("storyUrl") or ""))
        item["localUpdateScore"] = round(float(item.get("localUpdateScore") or 0) + 0.7, 3)
    return item


def fresh_verified_events(combined: list[dict], now: dt.datetime) -> list[dict]:
    rows = []
    for raw in combined:
        item = dict(raw)
        status = clean(item.get("verificationStatus")).lower()
        confidence = float(item.get("confidenceScore") or 0)
        age = source_age_hours(item, now)
        if status in {"community_lead", "unverified", "unverified_community_report"}:
            continue
        if confidence < 4.0 or age is None or age > LOCAL_MAX_HOURS:
            continue
        rows.append(item)
    return rows


def relation_words(story: dict) -> set[str]:
    words = set()
    for subject in story.get("subjects") or []:
        for token in re.findall(r"[a-z0-9]+", str(subject).lower()):
            if len(token) >= 4 and token not in GENERIC_RELATION_WORDS:
                words.add(token)
    return words


def related_event(story: dict, events: list[dict]) -> tuple[dict | None, float]:
    """Find a fresh event that gives an existing explainer/story a real why-now hook."""
    best = None
    best_score = 0.0
    subject_words = relation_words(story)
    for event in events:
        score = similar(
            {"headline": story.get("headline") or story.get("title"), "summary": story.get("deck") or ""},
            {"headline": event.get("headline") or "", "summary": event.get("summary") or event.get("deck") or event.get("description") or ""},
        )
        event_text = " ".join(
            clean(event.get(key)).lower()
            for key in ("headline", "summary", "deck", "description", "eventType", "category", "topic")
        )
        hits = {word for word in subject_words if re.search(rf"\b{re.escape(word)}\b", event_text)}
        if len(hits) >= 2:
            score = max(score, 0.68)
        elif len(hits) == 1 and score >= 0.32:
            score = max(score, 0.55)
        if score >= RELATED_STORY_MIN_SIMILARITY and score > best_score:
            best = event
            best_score = score
    return best, best_score


def is_anniversary(story: dict, now: dt.datetime) -> bool:
    published = parse_time(
        story.get("datePublished")
        or story.get("publishedAt")
        or story.get("published")
        or story.get("activeFrom")
    )
    return bool(published and published.year < now.year and (published.month, published.day) == (now.month, now.day))


def contextual_story_candidates(home: dict, catalog: dict, combined: list[dict], hero: str, now: dt.datetime) -> list[dict]:
    """Surface Burlington News stories only when a current hook actually exists."""
    pool = []
    seen = set()
    sources = list(home.get("latest") or []) + list(home.get("rail") or []) + list(home.get("feature") or []) + list(catalog.get("items") or [])
    for story in sources:
        key = clean(story.get("id") or story.get("url"))
        if not key or key in seen:
            continue
        seen.add(key)
        pool.append(story)

    events = fresh_verified_events(combined, now)
    rows = []
    for story in pool:
        if clean(story.get("status")).lower() == "expired":
            continue
        evidence = clean((story.get("gates") or {}).get("evidence")).lower()
        if evidence and evidence != "passed":
            continue
        story_url = base.public_story_url(str(story.get("url") or story.get("storyUrl") or ""))
        if not story_url or (hero and story_url == hero):
            continue

        explicit_reason = clean(story.get("localUpdateReason"))
        anniversary = bool(story.get("anniversaryMatch")) or is_anniversary(story, now)
        relation, relation_score = related_event(story, events)
        if not explicit_reason and not anniversary and not relation:
            continue

        published = (
            story.get("sourcePublishedAt")
            or story.get("lastMeaningfulUpdate")
            or story.get("publishedAt")
            or story.get("datePublished")
            or story.get("published")
            or story.get("activeFrom")
        )
        item = {
            **story,
            "headline": story.get("headline") or story.get("title"),
            "storyUrl": story_url,
            "sourceName": "Burlington News",
            "sourceType": "reporting",
            "verificationStatus": "reported",
            "confidenceScore": 4.5,
            "localRelevance": 5.0,
            "publishedAt": published,
            "contextTimestamp": now.isoformat(),
        }
        base.breaking_score(item, now)
        base.local_update_score(item)

        if anniversary:
            item["anniversaryMatch"] = True
            item["localUpdateReason"] = explicit_reason or "anniversary"
            item["localUpdateScore"] = round(float(item.get("localUpdateScore") or 0) + 1.6, 3)
        elif relation:
            item["relatedCurrentEvent"] = clean(relation.get("headline"))
            item["relatedCurrentEventUrl"] = relation.get("sourceUrl") or relation.get("storyUrl") or ""
            item["contextSignal"] = "related-current-event"
            item["localUpdateReason"] = explicit_reason or "related current event"
            item["contextMatchScore"] = round(relation_score, 3)
            item["localUpdateScore"] = round(float(item.get("localUpdateScore") or 0) + 1.3, 3)
        else:
            item["localUpdateReason"] = explicit_reason
            item["localUpdateScore"] = round(float(item.get("localUpdateScore") or 0) + 1.1, 3)
        rows.append(item)
    return rows


def fresh_direct_candidates(combined: list[dict], hero: str, archive: dict, now: dt.datetime) -> list[dict]:
    rows = []
    for raw in combined:
        item = dict(raw)
        if hero and base.public_story_url(str(item.get("storyUrl") or "")) == hero:
            continue
        status = clean(item.get("verificationStatus")).lower()
        confidence = float(item.get("confidenceScore") or 0)
        local = float(item.get("localRelevance") or 0)
        age = source_age_hours(item, now)
        if status in {"community_lead", "unverified", "unverified_community_report"}:
            continue
        if confidence < 4.0 or local < 2.4 or age is None or age > LOCAL_MAX_HOURS:
            continue
        rows.append(annotate_candidate(item, archive))
    return rows


def regional_candidates(now_iso: str, archive: dict, now: dt.datetime) -> list[dict]:
    rows = []
    for raw in hps_collect(now_iso, live=True, include_regional=True):
        if not raw.get("regionalFallback"):
            continue
        item = dict(raw)
        breaking_score(item, now)
        age = source_age_hours(item, now)
        if age is None or age > REGIONAL_MAX_HOURS:
            continue
        if float(item.get("confidenceScore") or 0) < 4.0:
            continue
        if float(item.get("impactScore") or 0) < 2.8:
            continue
        item["storyUrl"] = item.get("sourceUrl") or "/news/"
        rows.append(annotate_candidate(item, archive))
    rows.sort(
        key=lambda row: (
            bool(row.get("followUpUpdate")),
            float(row.get("localUpdateScore") or 0),
            -float(source_age_hours(row, now) or 999),
        ),
        reverse=True,
    )
    return rows


def main() -> int:
    now = dt.datetime.now(TZ)
    now_iso = now.isoformat()
    policy = load_policy().get("breakingNow") or {}
    home = load("home-surface.json", {})
    catalog = load("story-catalog.json", {"items": []})
    archive = load("breaking-archive.json", {"items": []})
    combined, leftover = base.collect_all(now_iso, True)
    hero = base.hero_url(home)

    accepted = []
    rejected = []
    lifecycle_updates = []
    for item in combined:
        ok, reason = passes_breaking_threshold(item, now)
        if hero and base.public_story_url(str(item.get("storyUrl") or "")) == hero:
            rejected.append({**item, "rejectReason": "hero-duplicate"})
            continue
        if is_resolved(item):
            resolved = annotate_candidate(item, archive)
            rejected.append({**resolved, "rejectReason": "resolved-update"})
            age = source_age_hours(resolved, now)
            verification = clean(resolved.get("verificationStatus")).lower()
            if (
                resolved.get("followUpUpdate")
                and verification not in {"community_lead", "unverified", "unverified_community_report"}
                and float(resolved.get("confidenceScore") or 0) >= 4.0
                and age is not None
                and age <= LOCAL_MAX_HOURS
            ):
                lifecycle_updates.append(resolved)
            continue
        if not ok:
            rejected.append({**item, "rejectReason": reason})
            continue
        accepted.append(item)

    accepted.sort(key=lambda row: float(row.get("breakingScore") or 0), reverse=True)
    breaking_visible = strict_diversify(accepted, int(policy.get("maxItems") or 2))

    if breaking_visible:
        mode = "breaking"
        label = "Breaking News"
        visible = breaking_visible
        method = "Strict Burlington Breaking News threshold passed; duplicate editorial families are blocked."
    else:
        local_pool = fresh_direct_candidates(combined, hero, archive, now)
        local_pool.extend(contextual_story_candidates(home, catalog, combined, hero, now))
        deduped = {}
        for item in local_pool:
            key = str(item.get("storyUrl") or item.get("id") or item.get("headline") or "")
            if not key:
                continue
            if key not in deduped or float(item.get("localUpdateScore") or 0) > float(deduped[key].get("localUpdateScore") or 0):
                deduped[key] = item
        ranked = sorted(
            deduped.values(),
            key=lambda row: (
                bool(row.get("anniversaryMatch")),
                bool(row.get("relatedCurrentEvent")),
                bool(row.get("followUpUpdate")),
                float(row.get("localUpdateScore") or 0),
            ),
            reverse=True,
        )
        if ranked:
            visible = strict_diversify(ranked, 2)
            method = "Local Update ranks fresh verified news plus existing stories with a real why-now hook such as a related current event, meaningful update or anniversary; duplicate editorial families are blocked."
        else:
            visible = strict_diversify(regional_candidates(now_iso, archive, now), 2)
            method = "No Burlington/Halton item had a strong current hook, so the rail used a verified regional fallback when available."
        mode = "local_update"
        label = "Local Update"

    base.prepare_public_items(visible)
    payload = {
        "generatedAt": now_iso,
        "mode": mode,
        "label": label,
        "method": method,
        "maxItems": 2,
        "liveFetches": True,
        "fallbackPolicy": {
            "directMaxAgeHours": LOCAL_MAX_HOURS,
            "regionalMaxAgeHours": REGIONAL_MAX_HOURS,
            "priority": ["Burlington", "Halton/Oakville", "QEW/Lakeshore West/Skyway", "Hamilton", "Toronto only when Burlington-relevant"],
            "followUps": "Fresh source updates to archived stories receive a priority bonus; unchanged old stories do not become new again.",
            "context": "Existing Burlington News stories require a related current event, meaningful update, explicit context signal or anniversary before they can enter Local Update.",
        },
        "items": visible,
        "lifecycleUpdates": lifecycle_updates[:10],
        "sourceNotes": {
            "officialPolice": "Halton Police, Hamilton Police, OPP and Toronto Police official newsroom/RSS/HTML feeds are checked live.",
            "regionalFallback": "Hamilton may fill Local Update only when the direct Burlington/Halton rail has no sufficiently fresh verified item. Toronto still requires existing Burlington/corridor relevance.",
            "reddit": "discovery only until an official or newsroom source corroborates",
        },
    }
    queue = {
        "generatedAt": now_iso,
        "items": leftover + [row for row in rejected if clean(row.get("verificationStatus")).lower() in {"community_lead", "unverified"}],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Live rail refresh: {label} / {len(visible)} public items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
