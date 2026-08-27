#!/usr/bin/env python3
"""Build Breaking Now and the internal discovery queue from source adapters.

Uses cached official JSON first so the homepage never waits on live fetches.
Optional --live tries public RSS/HTML endpoints and skips them on failure.
Official X discovery is optional and activates only with X_BEARER_TOKEN.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
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
from sources.x_twitter import collect as x_collect

TZ = ZoneInfo("America/Toronto")
OUT = DATA / "breaking-now.json"
QUEUE = DATA / "discovery-queue.json"


def load(name: str, fallback):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def catalog_url(item: dict, catalog: dict) -> str:
    headline = str(item.get("headline") or "")
    best = ""
    best_score = 0.0
    for story in catalog.get("items") or []:
        probe = {"headline": story.get("headline") or story.get("title"), "summary": story.get("deck") or ""}
        score = similar(item, probe)
        if score > best_score and score >= 0.55:
            best_score = score
            best = story.get("url") or story.get("path") or ""
    return best


def hero_url(home: dict) -> str:
    feature = (home.get("feature") or [None])[0] or {}
    return str(feature.get("url") or "")


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
    officials += x_collect()
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


def diversify_top(items: list[dict], limit: int = 2) -> list[dict]:
    if len(items) <= limit:
        return items[:limit]
    first = items[0]
    second = None
    for item in items[1:]:
        if str(item.get("category") or "") != str(first.get("category") or ""):
            second = item
            break
    if second is None:
        second = items[1]
    same = items[1]
    if str(same.get("category") or "") == str(first.get("category") or "") and second is not None:
        same_impact = float(same.get("impactScore") or 0)
        same_score = float(same.get("breakingScore") or 0)
        diverse_impact = float(second.get("impactScore") or 0)
        diverse_score = float(second.get("breakingScore") or 0)
        weak_filler = diverse_impact < 3.8
        stronger_emergency = same_impact >= 4.6 and same_score + 0.05 >= diverse_score
        if weak_filler or stronger_emergency:
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
    combined, leftover = collect_all(now_iso, live)
    hero = hero_url(load("home-surface.json", {}))

    accepted = []
    rejected = []
    for item in combined:
        ok, reason = passes_breaking_threshold(item, now)
        if hero and item.get("storyUrl") == hero:
            rejected.append({**item, "rejectReason": "hero-duplicate"})
            continue
        if not ok:
            rejected.append({**item, "rejectReason": reason})
            continue
        accepted.append(item)

    accepted.sort(key=lambda row: float(row.get("breakingScore") or 0), reverse=True)
    visible = diversify_top(accepted, int(policy.get("maxItems") or 2))

    payload = {
        "generatedAt": now_iso,
        "method": "breakingScore = localRelevance*0.25 + impact*0.25 + recency*0.20 + confidence*0.15 + breadth*0.10 + novelty*0.05. Ordinary bar is confidence >= 4 and high/strong-medium impact. Community leads stay unpublished until corroborated.",
        "maxItems": 2,
        "liveFetches": live,
        "items": visible,
        "sourceNotes": {
            "xTwitter": "official HaltonPolice/HamiltonPolice urgent-post discovery via X API v2 when X_BEARER_TOKEN is configured; otherwise skipped",
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
    print(f"Breaking Now: {len(visible)} public, {len(leftover)} community leads, {len(rejected)} rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
