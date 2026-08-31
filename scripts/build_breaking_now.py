#!/usr/bin/env python3
"""Build the homepage live-news card and internal discovery queue.

The public card has two modes:
- Breaking News when an item clears the strict breaking threshold.
- Local Update when nothing is truly breaking; verified, useful Burlington-area
  developments are ranked instead so the module remains useful without inventing urgency.

Uses cached official JSON first so the homepage never waits on live fetches.
Optional --live tries public RSS/HTML endpoints and skips them on failure.
Primary breaking discovery comes from official police/newsroom feeds, Ontario 511,
Metrolinx, municipal/regional sources, weather, and established local newsrooms.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
sys.path.insert(0, str(Path(__file__).resolve().parent))

from editorial_policy import load_policy
from sources.burlington import collect as city_collect
from sources.facebook import collect as facebook_collect
from sources.halton_police import collect as hrps_collect
from sources.halton_region import collect as region_collect
from sources.hamilton_police import collect as hps_collect
from sources.local_news import collect as news_collect
from sources.metrolinx import collect as go_collect
from sources.ontario511 import collect as on511_collect
from sources.opp import collect as opp_collect
from sources.reddit import collect as reddit_collect
from sources.score import breaking_score, passes_breaking_threshold
from sources.toronto_police import collect as tps_collect
from sources.verify import cluster_updates, corroborate, rewrite_verified_headline, similar
from sources.weather import collect as weather_collect
from story_lifecycle import is_resolved

TZ = ZoneInfo("America/Toronto")
OUT = DATA / "breaking-now.json"
QUEUE = DATA / "discovery-queue.json"
LOCATION_SUFFIXES = {
    "street", "road", "avenue", "drive", "line", "park", "creek", "trail",
    "highway", "boulevard", "lane", "court", "place", "way", "bay", "bridge",
    "centre", "center", "square", "falls", "mountain", "harbour", "harbor",
}


def load(name: str, fallback):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def agency_prefix(item: dict) -> str:
    """Return an accurate reader-facing police-service prefix.

    Burlington and Oakville are policed by Halton Regional Police, so we avoid
    inventing a municipal police service and use "Halton police in Burlington"
    or "Halton police in Oakville" when the city is known.
    """
    source = clean_text(item.get("sourceName")).lower()
    city = clean_text(item.get("city"))
    if "hamilton police" in source:
        return "Hamilton police"
    if "halton regional police" in source or "halton police" in source:
        if city and city.lower() not in {"halton", "halton region"}:
            return f"Halton police in {city}"
        return "Halton police"
    if "toronto police" in source:
        return "Toronto police"
    if "ontario provincial police" in source or re.search(r"\bopp\b", source):
        return "OPP"
    return ""


def scope_label(item: dict) -> str:
    city = clean_text(item.get("city"))
    if city:
        return city
    region = clean_text(item.get("region"))
    if region:
        return region
    source = clean_text(item.get("sourceName"))
    if "Hamilton Police" in source:
        return "Hamilton"
    if "Halton" in source:
        return "Halton"
    if "Toronto Police" in source:
        return "Toronto"
    return ""


def sentence_fragment(value: str, item: dict) -> str:
    """Convert a newsroom title-case fragment to readable sentence case.

    Acronyms and likely place names (the word before Street/Road/etc.) are
    preserved so QEW and Mud Street do not become qew or mud street.
    """
    words = clean_text(value).split()
    if not words:
        return ""

    preserve: set[int] = set()
    known = set()
    for field in ("city", "region", "location", "nearestIntersection", "affectedArea"):
        known.update(re.findall(r"[A-Za-z0-9]+", clean_text(item.get(field)).lower()))

    bare_words: list[str] = []
    for index, word in enumerate(words):
        bare = re.sub(r"^[^A-Za-z0-9]+|[^A-Za-z0-9]+$", "", word)
        bare_words.append(bare)
        if not bare:
            preserve.add(index)
            continue
        if (bare.isupper() and len(bare) > 1) or bare.lower() in known:
            preserve.add(index)
        if bare.lower() in LOCATION_SUFFIXES:
            preserve.add(index)
            if index:
                preserve.add(index - 1)

    output = []
    for index, word in enumerate(words):
        bare = bare_words[index]
        if not bare or index in preserve or any(char.isdigit() for char in bare):
            output.append(word)
            continue
        output.append(word.replace(bare, bare.lower(), 1))
    return " ".join(output)


def reader_headline(item: dict) -> str:
    """Make jurisdiction obvious without misnaming a police service."""
    raw = clean_text(item.get("headline") or item.get("shortHeadline"))
    if not raw:
        return raw

    agency = agency_prefix(item)
    city = clean_text(item.get("city"))
    starts_with_police = re.match(
        r"^(?:(?:Hamilton|Halton(?: Regional)?|Toronto|Ontario Provincial)\s+)?Police(?: Service)?\b",
        raw,
        flags=re.IGNORECASE,
    )

    if agency and starts_with_police:
        fragment = re.sub(
            r"^(?:(?:Hamilton|Halton(?: Regional)?|Toronto|Ontario Provincial)\s+)?Police(?: Service)?\s*[:\-–—]?\s*",
            "",
            raw,
            flags=re.IGNORECASE,
        )
        fragment = sentence_fragment(fragment, item)
        fragment = re.sub(
            r"\bfollowing (?:a )?shooting call on\b",
            "after a shooting call on",
            fragment,
            flags=re.IGNORECASE,
        )
        fragment = re.sub(r"\bfollowing\b", "after", fragment, flags=re.IGNORECASE)
        public = f"{agency} {fragment}".strip()
    elif agency and city and city.lower() not in raw.lower():
        public = f"{agency}: {raw}"
    elif city and city.lower() != "burlington" and city.lower() not in raw.lower():
        public = f"{city}: {raw}"
    else:
        public = raw

    return public.rstrip(" .") + "."


def prepare_public_items(items: list[dict]) -> None:
    for item in items:
        original = clean_text(item.get("headline") or item.get("shortHeadline"))
        if original:
            item.setdefault("rawHeadline", original)
            public = reader_headline(item)
            item["headline"] = public
            item["shortHeadline"] = public
        scope = scope_label(item)
        if scope:
            item["scopeLabel"] = scope
        agency = agency_prefix(item)
        if agency:
            item["agencyLabel"] = agency[0].upper() + agency[1:]


def public_story_url(value: str) -> str:
    raw = str(value or "")
    if raw.startswith("/"):
        return raw
    if raw.startswith("articles/") and raw.endswith(".html"):
        slug = raw[len("articles/"):-len(".html")]
        if slug == "burlington-hotspots-0-24":
            slug = "burlington-ultimate-team-0-24"
        return f"/stories/{slug}/"
    return raw or "/news/"


def catalog_url(item: dict, catalog: dict) -> str:
    best = ""
    best_score = 0.0
    for story in catalog.get("items") or []:
        probe = {"headline": story.get("headline") or story.get("title"), "summary": story.get("deck") or ""}
        score = similar(item, probe)
        if score > best_score and score >= 0.55:
            best_score = score
            best = story.get("url") or story.get("path") or ""
    return public_story_url(best)


def hero_url(home: dict) -> str:
    feature = (home.get("feature") or [None])[0] or {}
    return public_story_url(str(feature.get("url") or ""))


def collect_all(now_iso: str, live: bool) -> tuple[list[dict], list[dict]]:
    monitor = load("source-monitor.json", {"items": []})
    pulse = load("community-pulse.json", {})
    go = load("go-status.json", {})
    traffic = load("traffic-surface.json", {})
    radar = load("local-radar.json", {})
    catalog = load("story-catalog.json", {"items": []})

    officials: list[dict] = []
    officials += hrps_collect(now_iso, live=live)
    officials += hps_collect(now_iso, live=live)
    officials += opp_collect(now_iso, live=live)
    officials += tps_collect(now_iso, live=live)
    officials += go_collect(now_iso, go_status=go)
    officials += on511_collect(now_iso, traffic=traffic)
    officials += city_collect(now_iso, monitor=monitor)
    officials += region_collect(now_iso, monitor=monitor)
    officials += news_collect(now_iso, monitor=monitor)
    officials += weather_collect(now_iso, live=live)
    officials += facebook_collect()

    for row in radar.get("rightNow") or []:
        if row.get("eligibleRightNow") and float((row.get("signals") or {}).get("sourceConfidence") or 0) >= 3.8:
            officials.append({
                **row,
                "headline": row.get("headline") or row.get("title"),
                "sourceName": row.get("source"),
                "sourceUrl": row.get("url"),
                "sourceType": row.get("sourceType") or "reporting",
                "confidenceScore": (row.get("signals") or {}).get("sourceConfidence"),
                "publishedAt": row.get("published") or row.get("checkedAt") or now_iso,
            })

    leads = reddit_collect(now_iso, pulse=pulse)
    upgraded = []
    leftover = []
    for lead in leads:
        merged = corroborate(lead, officials)
        if str(merged.get("verificationStatus") or "") == "corroborated":
            upgraded.append(rewrite_verified_headline(merged))
        else:
            leftover.append(merged)

    combined = cluster_updates(officials + upgraded)
    for item in combined:
        breaking_score(item)
        article = catalog_url(item, catalog)
        item["storyUrl"] = article or f"/live/?id={item['id']}"
    return combined, leftover


def local_update_score(item: dict) -> float:
    """Fallback card: relevance .30 + freshness .25 + usefulness .20 + confidence .15 + interest .10."""
    local = float(item.get("localRelevance") or 0)
    recency = float(item.get("recencyScore") or 0)
    usefulness = max(float(item.get("impactScore") or 0), float(item.get("publicNeedScore") or 0))
    confidence = float(item.get("confidenceScore") or 0)
    raw_interest = item.get("readerInterestScore") or item.get("interestScore")
    if raw_interest is None:
        placement = float(item.get("placementScore") or 0)
        raw_interest = placement / 20 if placement else max(float(item.get("noveltyScore") or 0), float(item.get("breadthScore") or 0))
    interest = min(5.0, max(0.0, float(raw_interest or 0)))
    score = local * 0.30 + recency * 0.25 + usefulness * 0.20 + confidence * 0.15 + interest * 0.10
    item["localUpdateScore"] = round(score, 3)
    return score


def home_update_candidates(home: dict, hero: str) -> list[dict]:
    rows = []
    seen = set()
    for story in (home.get("latest") or []) + (home.get("rail") or []) + (home.get("feature") or []):
        key = str(story.get("id") or story.get("url") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        story_url = public_story_url(str(story.get("url") or ""))
        if hero and story_url == hero:
            continue
        item = {
            **story,
            "headline": story.get("headline") or story.get("title"),
            "storyUrl": story_url,
            "sourceName": "Burlington News",
            "sourceType": "reporting",
            "verificationStatus": "reported",
            "confidenceScore": 4.5,
            "localRelevance": 5.0,
            "publishedAt": story.get("lastMeaningfulUpdate") or story.get("publishedAt") or story.get("datePublished") or story.get("published") or story.get("activeFrom"),
        }
        breaking_score(item)
        local_update_score(item)
        rows.append(item)
    return rows


def diversify_top(items: list[dict], limit: int = 2, score_key: str = "breakingScore") -> list[dict]:
    if len(items) <= limit:
        return items[:limit]
    first = items[0]
    second = None
    for item in items[1:]:
        if str(item.get("category") or item.get("topic") or "") != str(first.get("category") or first.get("topic") or ""):
            second = item
            break
    if second is None:
        second = items[1]
    same = items[1]
    if str(same.get("category") or same.get("topic") or "") == str(first.get("category") or first.get("topic") or "") and second is not None:
        same_impact = float(same.get("impactScore") or 0)
        same_score = float(same.get(score_key) or 0)
        diverse_impact = float(second.get("impactScore") or 0)
        diverse_score = float(second.get(score_key) or 0)
        if diverse_impact < 2.4 or (same_impact >= 4.4 and same_score >= diverse_score + 0.2):
            second = same
    return [first, second]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Attempt official public feeds; skip on failure.")
    parser.add_argument("--offline", action="store_true", help="Use cached JSON only (default).")
    args = parser.parse_args()
    now = dt.datetime.now(TZ)
    now_iso = now.isoformat()
    live = bool(args.live) and not args.offline
    policy = load_policy().get("breakingNow") or {}
    home = load("home-surface.json", {})
    combined, leftover = collect_all(now_iso, live)
    hero = hero_url(home)

    accepted = []
    rejected = []
    for item in combined:
        ok, reason = passes_breaking_threshold(item, now)
        if hero and public_story_url(str(item.get("storyUrl") or "")) == hero:
            rejected.append({**item, "rejectReason": "hero-duplicate"})
            continue
        if is_resolved(item):
            rejected.append({**item, "rejectReason": "resolved-update"})
            continue
        if not ok:
            rejected.append({**item, "rejectReason": reason})
            continue
        accepted.append(item)

    accepted.sort(key=lambda row: float(row.get("breakingScore") or 0), reverse=True)
    breaking_visible = diversify_top(accepted, int(policy.get("maxItems") or 2), "breakingScore")

    if breaking_visible:
        mode = "breaking"
        label = "Breaking News"
        visible = breaking_visible
        method = "Breaking threshold passed. breakingScore = localRelevance*.25 + impact*.25 + recency*.20 + confidence*.15 + breadth*.10 + novelty*.05."
    else:
        local_pool = []
        for item in combined:
            if hero and public_story_url(str(item.get("storyUrl") or "")) == hero:
                continue
            status = str(item.get("verificationStatus") or "").lower()
            confidence = float(item.get("confidenceScore") or 0)
            local = float(item.get("localRelevance") or 0)
            if status in {"community_lead", "unverified", "unverified_community_report"} or confidence < 4.0 or local < 2.4:
                continue
            local_update_score(item)
            local_pool.append(item)
        local_pool.extend(home_update_candidates(home, hero))
        deduped = {}
        for item in local_pool:
            key = str(item.get("storyUrl") or item.get("id") or item.get("headline") or "")
            if not key:
                continue
            if key not in deduped or float(item.get("localUpdateScore") or 0) > float(deduped[key].get("localUpdateScore") or 0):
                deduped[key] = item
        ranked = sorted(deduped.values(), key=lambda row: float(row.get("localUpdateScore") or 0), reverse=True)
        mode = "local_update"
        label = "Local Update"
        visible = diversify_top(ranked, 2, "localUpdateScore")
        method = "No item cleared Breaking News. Local Update = Burlington relevance*.30 + freshness*.25 + practical impact/usefulness*.20 + source confidence*.15 + reader interest*.10."

    prepare_public_items(visible)

    payload = {
        "generatedAt": now_iso,
        "mode": mode,
        "label": label,
        "method": method,
        "maxItems": 2,
        "liveFetches": live,
        "items": visible,
        "sourceNotes": {
            "officialPolice": "Halton Police, Hamilton Police, OPP and Toronto Police official newsroom/RSS/HTML feeds are checked directly when live mode is enabled.",
            "regionalNews": "CHCH, CP24 and other established local/regional newsrooms are used as corroboration and fallback reporting sources.",
            "xTwitter": "not required; paid X API access is intentionally not part of the breaking-news dependency chain",
            "facebook": "skipped; no private or login-walled collection",
            "reddit": "discovery only until an official or newsroom source corroborates",
        },
    }
    queue = {
        "generatedAt": now_iso,
        "items": leftover + [row for row in rejected if str(row.get("verificationStatus") or "") in {"community_lead", "unverified"}],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Live news: {label} / {len(visible)} public, {len(leftover)} community leads, {len(rejected)} rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
