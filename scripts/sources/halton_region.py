"""Halton Region official notices from the civic watch cache."""

from __future__ import annotations

from typing import Any

from .model import quick_update

HIGH = ("emergency", "outage", "water", "wastewater", "public health", "evacuation", "spill")


def collect(now_iso: str, monitor: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    items = []
    for raw in (monitor or {}).get("items") or []:
        source = str(raw.get("source") or "")
        if "Halton Region" not in source:
            continue
        headline = raw.get("title") or raw.get("headline") or ""
        text = f"{headline} {raw.get('description') or ''}".lower()
        if not any(term in text for term in HIGH):
            continue
        items.append(quick_update(
            headline=headline,
            summary=raw.get("description") or "",
            category="ENVIRONMENT" if any(term in text for term in ("spill", "water", "health")) else "CITY HALL",
            eventType="region",
            sourceType="official",
            sourceName=source,
            sourceUrl=raw.get("url") or "",
            publishedAt=raw.get("published") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="verified" if raw.get("verified") else "reported",
            confidenceScore=5.0 if raw.get("verified") else 4.0,
            city="Halton",
            storyUrl="",
        ))
    return items
