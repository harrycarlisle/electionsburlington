"""Ontario 511 incidents already normalized into traffic-surface.json."""

from __future__ import annotations

from typing import Any

from .cause import official_cause
from .model import quick_update
from .relevance import extract_location


def collect(now_iso: str, traffic: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    incidents = list((traffic or {}).get("incidents") or [])
    items = []
    for raw in incidents:
        kind = str(raw.get("type") or "")
        if kind not in {"collision", "closure"} and "all lanes" not in str(raw.get("rawHeadline") or "").lower():
            continue
        if raw.get("facility") in {"on-ramp", "off-ramp"} and kind != "collision":
            continue
        headline = raw.get("title") or raw.get("rawHeadline") or ""
        raw_headline = str(raw.get("rawHeadline") or headline)
        planned = any(term in raw_headline.lower() for term in ("construction", "maintenance", "engineering investigation", "nightly", "continuous"))
        location = extract_location(f"{headline} {raw.get('context') or ''} {raw.get('nearestRoad') or ''}")
        location["city"] = raw.get("municipality") or location.get("city")
        location["nearestIntersection"] = raw.get("nearestRoad") or location.get("nearestIntersection")
        location["location"] = raw.get("context") or location.get("location")

        # Never use traffic-surface.generatedAt (our crawler refresh time) as the
        # event's publication time. That made long-running construction look like
        # brand-new Breaking News every half hour. Only a source timestamp may
        # make a 511 item fresh. Current normalized surfaces do not yet expose an
        # ISO source timestamp, so unknown stays unknown rather than being faked.
        source_time = raw.get("updatedAt") or raw.get("sourceUpdatedAt") or raw.get("publishedAt") or ""

        item = quick_update(
            headline=headline,
            summary=raw.get("impact") or raw.get("context") or "",
            category="TRAFFIC",
            eventType=kind or "traffic",
            sourceType="official",
            sourceName=raw.get("source") or "Ontario 511",
            sourceUrl=raw.get("url") or "/traffic/",
            publishedAt=source_time,
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            relatedUtility="skyway" if raw.get("affectsSkyway") else "driving",
            cause=official_cause(f"{headline} {raw_headline}", official=True),
            severity="moderate" if planned else ("high" if kind in {"collision", "closure"} else "moderate"),
            storyUrl="/live/",
            **location,
        )
        if planned:
            item["plannedTrafficWork"] = True
        items.append(item)
    return items
