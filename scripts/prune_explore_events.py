#!/usr/bin/env python3
"""Remove expired Explore listings from the live feed and preserve them in an archive."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "data" / "explore-events.json"
ARCHIVE = ROOT / "data" / "explore-events-archive.json"
TZ = ZoneInfo("America/Toronto")
GRACE = dt.timedelta(minutes=20)


def parse(value: object) -> dt.datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ)
    return parsed.astimezone(TZ)


def main() -> None:
    payload = json.loads(LIVE.read_text())
    now = dt.datetime.now(TZ)
    active: list[dict[str, object]] = []
    expired: list[dict[str, object]] = []

    for event in payload.get("events", []):
        end = parse(event.get("end"))
        start = parse(event.get("start"))
        if end is None and start is not None:
            end = start + dt.timedelta(hours=3)
        if end is not None and end < now - GRACE:
            expired.append(event)
        else:
            active.append(event)

    active.sort(key=lambda item: parse(item.get("start")) or dt.datetime.max.replace(tzinfo=TZ))
    payload["events"] = active
    payload["updated"] = now.replace(microsecond=0).isoformat()
    payload["freshnessPolicy"] = "Expired events are archived shortly after their scheduled end time."
    LIVE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    archive_payload: dict[str, object] = {"updated": now.replace(microsecond=0).isoformat(), "events": []}
    if ARCHIVE.exists():
        try:
            archive_payload = json.loads(ARCHIVE.read_text())
        except Exception:
            archive_payload = {"updated": now.replace(microsecond=0).isoformat(), "events": []}

    archive_by_id = {
        str(item.get("id")): item
        for item in archive_payload.get("events", [])
        if isinstance(item, dict) and item.get("id")
    }
    for event in expired:
        event = dict(event)
        event["archivedAt"] = now.replace(microsecond=0).isoformat()
        archive_by_id[str(event.get("id"))] = event

    archived = list(archive_by_id.values())
    archived.sort(key=lambda item: parse(item.get("end")) or parse(item.get("start")) or dt.datetime.min.replace(tzinfo=TZ), reverse=True)
    archive_payload = {
        "updated": now.replace(microsecond=0).isoformat(),
        "events": archived[:300]
    }
    ARCHIVE.write_text(json.dumps(archive_payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Explore freshness: {len(active)} active, {len(expired)} newly archived")


if __name__ == "__main__":
    main()
