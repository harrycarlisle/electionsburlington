"""r/BurlingtonON is a discovery layer, never a verified fact source."""

from __future__ import annotations

from typing import Any

from .model import quick_update
from .relevance import extract_location


def collect(now_iso: str, pulse: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    item = (pulse or {}).get("item")
    if not item:
        return []
    headline = item.get("title") or item.get("headline") or ""
    if not headline:
        return []
    location = extract_location(headline)
    return [quick_update(
        id=f"reddit:{item.get('id') or ''}",
        headline=headline,
        summary="Community report. Not verified.",
        category="PUBLIC SAFETY" if any(term in headline.lower() for term in ("police", "crash", "fire", "closed")) else "COMMUNITY",
        eventType="community",
        sourceType="community",
        sourceName=item.get("source") or "Public Reddit · r/BurlingtonON",
        sourceUrl=item.get("url") or "",
        publishedAt=item.get("publishedAt") or pulse.get("checkedAt") or now_iso,
        discoveredAt=now_iso,
        verificationStatus="community_lead",
        confidenceScore=1.5,
        label="UNVERIFIED",
        storyUrl="",
        **location,
    )]
