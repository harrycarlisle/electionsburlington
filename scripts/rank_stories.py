#!/usr/bin/env python3
"""Build homepage placement from explicit editorial signals and expiry windows."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "story-catalog.json"
OUTPUT = ROOT / "data" / "home-surface.json"
WEIGHTS = {
    "relevance": 0.30,
    "breadth": 0.20,
    "novelty": 0.20,
    "familiarity": 0.15,
    "consequence": 0.15,
}


def parse_date(value: str | None) -> dt.date | None:
    return dt.date.fromisoformat(value) if value else None


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


def score(item: dict) -> int:
    signals = item.get("signals", {})
    weighted = sum(float(signals.get(name, 0)) * weight for name, weight in WEIGHTS.items())
    return round(weighted / 5 * 100)


def public_item(item: dict) -> dict:
    keys = ("id", "kind", "headline", "deck", "label", "labelEssential", "url", "image", "alt", "credit", "mediaKey", "byline")
    return {key: item[key] for key in keys if key in item}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Evaluate the surface on YYYY-MM-DD")
    args = parser.parse_args()
    today = parse_date(args.date) if args.date else dt.datetime.now(ZoneInfo("America/Toronto")).date()
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    audited = []
    for item in payload.get("items", []):
        state, reason = gate_state(item, today)
        audited.append({**item, "state": state, "reason": reason, "placementScore": score(item)})

    eligible = [item for item in audited if item["state"] == "eligible"]
    eligible.sort(key=lambda item: (item["placementScore"], item.get("published", "")), reverse=True)
    pick = lambda surface, limit: [public_item(item) for item in eligible if surface in item.get("surfaces", [])][:limit]
    feature_candidates = [item for item in eligible if "feature" in item.get("surfaces", [])]
    feature_candidates.sort(key=lambda item: (item.get("kind") == "feature", item["placementScore"]), reverse=True)
    result = {
        "generatedFor": today.isoformat(),
        "method": "Evidence and rights gates first; eligible stories are sorted by relevance, breadth, novelty, familiarity and consequence. Scores choose placement and are not shown to readers.",
        "feature": [public_item(item) for item in feature_candidates[:3]],
        "rail": pick("rail", 3),
        "latest": [
            public_item(item)
            for item in sorted(
                (candidate for candidate in eligible if "latest" in candidate.get("surfaces", [])),
                key=lambda candidate: (candidate.get("published", candidate.get("activeFrom", "")), candidate["placementScore"]),
                reverse=True,
            )[:3]
        ],
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
