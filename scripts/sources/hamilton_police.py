"""Hamilton Police Service — only when the event can affect Burlington."""

from __future__ import annotations

from typing import Any

from .fetch import try_feeds
from .model import quick_update
from .relevance import extract_location, police_relevance

SOURCE = "Hamilton Police Service"
FEEDS = [
    "https://hamiltonpolice.on.ca/news/feed",
    "https://hamiltonpolice.ca/news/feed",
    "https://hamiltonpolice.on.ca/news",
]


def collect(now_iso: str, *, live: bool = False, cached: list[dict] | None = None) -> list[dict[str, Any]]:
    rows = list(cached or [])
    for raw in try_feeds(FEEDS, live=live):
        rows.append(raw)
    items = []
    for raw in rows:
        headline = raw.get("title") or raw.get("headline") or ""
        if not headline:
            continue
        location = extract_location(f"{headline} {raw.get('summary') or ''}")
        item = quick_update(
            headline=headline,
            summary=raw.get("summary") or "",
            category="PUBLIC SAFETY",
            eventType="police",
            sourceType="official",
            sourceName=SOURCE,
            sourceUrl=raw.get("url") or raw.get("sourceUrl") or "",
            publishedAt=raw.get("publishedAt") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            city=location.get("city") or "Hamilton",
            **{k: v for k, v in location.items() if k != "city"},
        )
        ok, reason = police_relevance(SOURCE, item)
        if not ok:
            item["rejectReason"] = reason
            continue
        items.append(item)
    return items
