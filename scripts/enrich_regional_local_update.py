#!/usr/bin/env python3
"""Add one fresh regional news item when Local Update is otherwise just utility data.

The traffic/GO utility already has its own prominent rail. When the Local Update
selector only finds traffic, this pass may add a recent, verified Hamilton Police
item so the news rail does not become a duplicate traffic ticker. It never changes
Breaking News, never changes the main homepage/story ranking, and never promotes
an unknown-time item as fresh.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from build_breaking_now import local_update_score
from sources.hamilton_police import collect as hamilton_collect
from sources.score import breaking_score, source_age_hours
from sources.verify import similar

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "breaking-now.json"
TZ = ZoneInfo("America/Toronto")
MAX_REGIONAL_AGE_HOURS = 24.0


def is_news(item: dict) -> bool:
    return str(item.get("category") or "").upper() not in {"TRAFFIC", "TRANSIT", "WEATHER"}


def main() -> int:
    payload = json.loads(PATH.read_text(encoding="utf-8"))
    if payload.get("mode") == "breaking":
        print("Breaking News active; regional supplement skipped")
        return 0

    current = [item for item in (payload.get("items") or []) if isinstance(item, dict)]
    if any(is_news(item) for item in current) and len(current) >= 2:
        print("Fresh news already present in Local Update")
        return 0

    now = dt.datetime.now(TZ)
    candidates = []
    for raw in hamilton_collect(now.isoformat(), live=True, include_regional=True):
        item = dict(raw)
        age = source_age_hours(item, now)
        if age is None or age > MAX_REGIONAL_AGE_HOURS:
            continue
        if float(item.get("confidenceScore") or 0) < 4.0:
            continue
        breaking_score(item, now)
        local_update_score(item)
        item["storyUrl"] = item.get("sourceUrl") or "/news/"
        item["regionalSupplement"] = True
        if any(similar(item, existing) >= 0.52 for existing in current):
            continue
        candidates.append(item)

    candidates.sort(
        key=lambda item: (
            float(item.get("impactScore") or 0),
            float(item.get("localUpdateScore") or 0),
            -float(source_age_hours(item, now) or 999),
        ),
        reverse=True,
    )
    if not candidates:
        print("No fresh regional news supplement available")
        return 0

    # Keep the live rail compact. If a direct Burlington/Halton item exists it
    # stays first; this fills only an open second slot. A utility-only rail may
    # therefore become [traffic, regional news] rather than two traffic rows.
    if len(current) < 2:
        current.append(candidates[0])
    elif not any(is_news(item) for item in current):
        current[-1] = candidates[0]
    else:
        return 0

    payload["items"] = current[:2]
    payload["method"] = str(payload.get("method") or "") + " Fresh regional news may fill an otherwise utility-only second slot."
    PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Regional Local Update supplement: {candidates[0].get('headline')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
