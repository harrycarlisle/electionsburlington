#!/usr/bin/env python3
"""Refresh Breaking/Local Update without changing the main story ranking system.

This is intentionally a separate live-rail selector. It keeps the strict
Breaking News threshold from build_breaking_now.py, but prevents the fallback
Local Update rail from becoming stale wallpaper. Direct Burlington/Halton and
corridor updates win. If those are quiet, a fresh significant Hamilton item may
fill the rail. Toronto remains limited to items the existing relevance rules say
can affect Burlington.

A newly published source item that clearly continues an archived Burlington News
story gets a follow-up bonus and links back to the existing story when possible.
Discovery time is never treated as publication time.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import build_breaking_now as base
from editorial_policy import load_policy
from sources.hamilton_police import collect as hps_collect
from sources.score import breaking_score, passes_breaking_threshold, source_age_hours
from sources.verify import similar

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TZ = ZoneInfo("America/Toronto")
OUT = DATA / "breaking-now.json"
QUEUE = DATA / "discovery-queue.json"
LOCAL_MAX_HOURS = 18.0
REGIONAL_MAX_HOURS = 24.0
FOLLOW_UP_MIN_SIMILARITY = 0.43


def load(name: str, fallback):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except Exception:
        return fallback


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
        # Only call it an update when the new source really is newer than the
        # source/publication timestamp already attached to the archived story.
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


def home_candidates(home: dict, hero: str, now: dt.datetime) -> list[dict]:
    """Use Burlington News stories only while they are genuinely recent.

    This prevents a two-day-old service story from winning Local Update merely
    because it has strong Burlington relevance.
    """
    rows = []
    seen = set()
    for story in (home.get("latest") or []) + (home.get("rail") or []) + (home.get("feature") or []):
        key = str(story.get("id") or story.get("url") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        story_url = base.public_story_url(str(story.get("url") or ""))
        if hero and story_url == hero:
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
        }
        base.breaking_score(item, now)
        age = source_age_hours(item, now)
        if age is None or age > LOCAL_MAX_HOURS:
            continue
        base.local_update_score(item)
        rows.append(item)
    return rows


def fresh_direct_candidates(combined: list[dict], hero: str, archive: dict, now: dt.datetime) -> list[dict]:
    rows = []
    for raw in combined:
        item = dict(raw)
        if hero and base.public_story_url(str(item.get("storyUrl") or "")) == hero:
            continue
        status = str(item.get("verificationStatus") or "").lower()
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
    # Hamilton is a neighbour, not Burlington. These items are considered only
    # after direct Burlington/Halton/corridor candidates have gone quiet.
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
    archive = load("breaking-archive.json", {"items": []})
    combined, leftover = base.collect_all(now_iso, True)
    hero = base.hero_url(home)

    accepted = []
    rejected = []
    for item in combined:
        ok, reason = passes_breaking_threshold(item, now)
        if hero and base.public_story_url(str(item.get("storyUrl") or "")) == hero:
            rejected.append({**item, "rejectReason": "hero-duplicate"})
            continue
        if not ok:
            rejected.append({**item, "rejectReason": reason})
            continue
        accepted.append(item)

    accepted.sort(key=lambda row: float(row.get("breakingScore") or 0), reverse=True)
    breaking_visible = base.diversify_top(accepted, int(policy.get("maxItems") or 2), "breakingScore")

    if breaking_visible:
        mode = "breaking"
        label = "Breaking News"
        visible = breaking_visible
        method = "Strict Burlington Breaking News threshold passed."
    else:
        local_pool = fresh_direct_candidates(combined, hero, archive, now)
        local_pool.extend(home_candidates(home, hero, now))
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
                bool(row.get("followUpUpdate")),
                float(row.get("localUpdateScore") or 0),
            ),
            reverse=True,
        )
        if ranked:
            visible = base.diversify_top(ranked, 2, "localUpdateScore")
            method = "Fresh Burlington/Halton Local Update. Existing main story scoring is unchanged; stale rail items are excluded after 18 hours."
        else:
            visible = regional_candidates(now_iso, archive, now)[:2]
            method = "No fresh Burlington/Halton update was available, so the rail used a verified regional fallback from a neighbouring official source."
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
        },
        "items": visible,
        "sourceNotes": {
            "officialPolice": "Halton Police, Hamilton Police, OPP and Toronto Police official newsroom/RSS/HTML feeds are checked live.",
            "regionalFallback": "Hamilton may fill Local Update only when the direct Burlington/Halton rail has no sufficiently fresh verified item. Toronto still requires existing Burlington/corridor relevance.",
            "reddit": "discovery only until an official or newsroom source corroborates",
        },
    }
    queue = {
        "generatedAt": now_iso,
        "items": leftover + [row for row in rejected if str(row.get("verificationStatus") or "") in {"community_lead", "unverified"}],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Live rail refresh: {label} / {len(visible)} public items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
