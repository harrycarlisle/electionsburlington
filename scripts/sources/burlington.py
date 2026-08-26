"""City of Burlington official notices from the civic watch cache."""

from __future__ import annotations

from typing import Any

from .model import quick_update
from .relevance import extract_location

HIGH = (
    "tax", "budget", "council approves", "council rejects", "data centre",
    "data center", "evacuat", "emergency", "closure", "boil water",
    "election", "advance voting", "hospital", "fire", "alert", "outage",
    "hydro", "transit suspend", "service interruption",
)


def collect(now_iso: str, monitor: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    items = []
    for raw in (monitor or {}).get("items") or []:
        source = str(raw.get("source") or "")
        official = (
            "City of Burlington" in source
            or "City mayoral" in source
            or "Burlington Transit" in source
            or "Burlington Fire" in source
            or "municipal alert" in source.lower()
        )
        if not official:
            continue
        headline = raw.get("title") or raw.get("headline") or ""
        text = f"{headline} {raw.get('description') or ''}".lower()
        if not any(term in text for term in HIGH):
            continue
        location = extract_location(headline)
        items.append(quick_update(
            headline=headline,
            summary=raw.get("description") or raw.get("why") or "",
            category="CITY HALL" if "tax" in text or "council" in text else "DEVELOPMENT",
            eventType="civic",
            sourceType="official",
            sourceName=source or "City of Burlington",
            sourceUrl=raw.get("url") or "",
            publishedAt=raw.get("published") or raw.get("checkedAt") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="verified" if raw.get("verified") else "reported",
            confidenceScore=5.0 if raw.get("verified") else 4.0,
            city="Burlington",
            storyUrl="",
            **{k: v for k, v in location.items() if k != "city"},
        ))
    return items
