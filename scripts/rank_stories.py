#!/usr/bin/env python3
"""Build Burlington News homepage placement from explicit editorial signals.

Evidence and rights gates run first. Eligible stories compete on reader interest,
Burlington relevance, novelty, familiarity, consequence, breadth, source confidence,
originality and freshness. This intentionally avoids becoming a chronological mirror
of any one local publisher.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "story-catalog.json"
OUTPUT = ROOT / "data" / "home-surface.json"
TZ = ZoneInfo("America/Toronto")

WEIGHTS = {
    "interest": 0.22,
    "relevance": 0.20,
    "novelty": 0.15,
    "familiarity": 0.11,
    "consequence": 0.12,
    "breadth": 0.07,
    "sourceConfidence": 0.08,
    "originality": 0.05,
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
    return 0.0


def freshness(item: dict, today: dt.date) -> float:
    if item.get("evergreen"):
        return 3.5
    published = parse_date(item.get("published") or item.get("activeFrom"))
    if not published:
        return 3.0
    age = max(0, (today - published).days)
    return max(0.8, 5.0 * math.exp(-age / 3.2))


def rotation(item: dict, today: dt.date) -> float:
    last = parse_date(item.get("lastHomepageLead"))
    if not last:
        return 5.0
    age = max(0, (today - last).days)
    return min(5.0, 1.8 + age * 0.9)


def score(item: dict, today: dt.date) -> int:
    base = sum(signal(item, name) * weight for name, weight in WEIGHTS.items())
    blended = base * 0.82 + freshness(item, today) * 0.13 + rotation(item, today) * 0.05
    # Explicitly discourage straight aggregation from becoming the lead.
    if item.get("aggregationOnly"):
        blended *= 0.78
    return round(max(0.0, min(5.0, blended)) / 5 * 100)


def public_item(item: dict) -> dict:
    keys = (
        "id", "kind", "headline", "deck", "label", "labelEssential", "url", "image",
        "alt", "credit", "mediaKey", "byline", "published", "activeFrom", "storyGoal"
    )
    return {key: item[key] for key in keys if key in item}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Evaluate the surface on YYYY-MM-DD")
    args = parser.parse_args()
    today = parse_date(args.date) if args.date else dt.datetime.now(TZ).date()
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    audited = []
    for item in payload.get("items", []):
        state, reason = gate_state(item, today)
        audited.append({**item, "state": state, "reason": reason, "placementScore": score(item, today)})

    eligible = [item for item in audited if item["state"] == "eligible"]
    eligible.sort(key=lambda item: (item["placementScore"], item.get("published", "")), reverse=True)

    feature_candidates = [item for item in eligible if "feature" in item.get("surfaces", [])]
    feature_candidates.sort(key=lambda item: (item["placementScore"], item.get("published", "")), reverse=True)
    rail = [public_item(item) for item in eligible if "rail" in item.get("surfaces", [])][:3]
    latest_candidates = [item for item in eligible if "latest" in item.get("surfaces", [])]
    latest_candidates.sort(key=lambda item: (item["placementScore"], item.get("published", item.get("activeFrom", ""))), reverse=True)

    result = {
        "generatedFor": today.isoformat(),
        "method": "Evidence and rights gates first. Placement blends interest, Burlington relevance, novelty, familiarity, consequence, breadth, source confidence, originality, freshness and rotation pressure. Aggregation-only items are penalized.",
        "feature": [public_item(item) for item in feature_candidates[:3]],
        "rail": rail,
        "latest": [public_item(item) for item in latest_candidates[:3]],
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
