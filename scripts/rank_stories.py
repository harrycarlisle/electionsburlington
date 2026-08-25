#!/usr/bin/env python3
"""Build Burlington News homepage placement from explicit editorial signals.

Evidence and rights gates run first. Eligible stories compete on reader interest,
Burlington relevance, novelty, familiarity, consequence, source confidence,
originality, visual strength, freshness and rotation pressure. The homepage should
behave like a publication, not a fixed list or a mirror of another publisher.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "story-catalog.json"
RADAR = ROOT / "data" / "local-radar.json"
OUTPUT = ROOT / "data" / "home-surface.json"
TZ = ZoneInfo("America/Toronto")

WEIGHTS = {
    "interest": 0.20,
    "relevance": 0.19,
    "novelty": 0.13,
    "familiarity": 0.10,
    "consequence": 0.12,
    "sourceConfidence": 0.08,
    "originality": 0.06,
    "visualStrength": 0.07,
    "breadth": 0.05,
}


def parse_date(value: str | None) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def gate_state(item: dict, today: dt.date) -> tuple[str, str]:
    gates = item.get("gates", {})
    required = ("evidence", "burlington", "imageRights", "duplicate")
    failed = [name for name in required if gates.get(name) != "passed"]
    if failed:
        return "held", "gate failed: " + ", ".join(failed)
    start = parse_date(item.get("activeFrom"))
    end = parse_date(item.get("activeUntil"))
    if start and today < start:
        return "scheduled", f"eligible {start.isoformat()}"
    if end and today > end:
        return "archive", f"seasonal window ended {end.isoformat()}"
    return "eligible", "all gates passed"


def signal(item: dict, name: str) -> float:
    values = item.get("signals", {})
    if name in values:
        return max(0.0, min(5.0, float(values[name])))
    if name == "interest":
        return max(float(values.get("novelty", 0)), float(values.get("breadth", 0)))
    if name == "sourceConfidence":
        tier = str(item.get("sourceConfidence") or item.get("verificationTier") or "").lower()
        return {"primary": 5, "official": 5, "reported": 4, "corroborated": 4, "community": 2}.get(tier, 4)
    if name == "originality":
        return 1 if item.get("aggregationOnly") else 5
    if name == "visualStrength":
        return 5 if item.get("image") else 2
    return 0.0


def freshness(item: dict, today: dt.date) -> float:
    if item.get("evergreen"):
        return 3.4
    published = parse_date(item.get("published") or item.get("activeFrom"))
    if not published:
        return 3.0
    age = max(0, (today - published).days)
    return max(0.7, 5.0 * math.exp(-age / 3.0))


def rotation(item: dict, today: dt.date) -> float:
    last = parse_date(item.get("lastHomepageLead"))
    if not last:
        return 5.0
    age = max(0, (today - last).days)
    return min(5.0, 1.4 + age * 1.0)


def radar_bonus(item: dict, radar_rows: list[dict]) -> float:
    title = re.sub(r"[^a-z0-9]+", " ", str(item.get("headline") or "").lower()).strip()
    if not title:
        return 0.0
    title_words = {word for word in title.split() if len(word) > 3}
    best = 0.0
    for row in radar_rows:
        other = re.sub(r"[^a-z0-9]+", " ", str(row.get("headline") or "").lower()).strip()
        words = {word for word in other.split() if len(word) > 3}
        if not words:
            continue
        overlap = len(title_words & words) / max(1, min(len(title_words), len(words)))
        if overlap >= .55:
            best = max(best, float(row.get("radarScore") or 0) / 100 * 5)
    return best


def score(item: dict, today: dt.date, radar_rows: list[dict]) -> int:
    base = sum(signal(item, name) * weight for name, weight in WEIGHTS.items())
    radar = radar_bonus(item, radar_rows)
    blended = base * 0.77 + freshness(item, today) * 0.12 + rotation(item, today) * 0.06 + radar * 0.05
    if item.get("aggregationOnly"):
        blended *= 0.76
    if "burlingtontoday" in str(item.get("source") or item.get("sourceName") or "").lower():
        blended *= 0.88
    return round(max(0.0, min(5.0, blended)) / 5 * 100)


def public_item(item: dict) -> dict:
    keys = (
        "id", "kind", "headline", "deck", "label", "labelEssential", "url", "image",
        "alt", "credit", "mediaKey", "byline", "published", "activeFrom", "storyGoal"
    )
    result = {key: item[key] for key in keys if key in item}
    result["placementScore"] = item.get("placementScore")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Evaluate the surface on YYYY-MM-DD")
    args = parser.parse_args()
    today = parse_date(args.date) if args.date else dt.datetime.now(TZ).date()
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    try:
        radar_rows = json.loads(RADAR.read_text(encoding="utf-8")).get("homepage", [])
    except Exception:
        radar_rows = []
    audited = []
    for item in payload.get("items", []):
        state, reason = gate_state(item, today)
        audited.append({**item, "state": state, "reason": reason, "placementScore": score(item, today, radar_rows)})

    eligible = [item for item in audited if item["state"] == "eligible"]
    eligible.sort(key=lambda item: (item["placementScore"], item.get("published", "")), reverse=True)

    feature_candidates = [item for item in eligible if "feature" in item.get("surfaces", []) and item.get("image")]
    feature_candidates.sort(key=lambda item: (item["placementScore"], item.get("published", "")), reverse=True)
    rail = [public_item(item) for item in eligible if "rail" in item.get("surfaces", [])][:3]
    latest_candidates = [item for item in eligible if "latest" in item.get("surfaces", [])]
    latest_candidates.sort(key=lambda item: (item["placementScore"], item.get("published", item.get("activeFrom", ""))), reverse=True)

    result = {
        "generatedFor": today.isoformat(),
        "method": "Evidence/rights gates first. Placement blends interest, relevance, novelty, familiarity, consequence, source confidence, originality, visual strength, freshness, radar context and rotation pressure.",
        "feature": [public_item(item) for item in feature_candidates[:4]],
        "rail": rail,
        "latest": [public_item(item) for item in latest_candidates[:6]],
        "audit": [
            {"id": item["id"], "state": item["state"], "placementScore": item["placementScore"], "reason": item["reason"]}
            for item in audited
        ],
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Ranked {len(eligible)} eligible stories for {today.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
