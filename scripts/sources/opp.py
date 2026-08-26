"""Ontario Provincial Police — highways and provincial emergencies only."""

from __future__ import annotations

from typing import Any

from .fetch import try_feeds
from .model import quick_update
from .relevance import extract_location, police_relevance

SOURCE = "Ontario Provincial Police"
FEEDS = [
    "https://www.opp.ca/index.php?id=115&rss=1",
    "https://www.opp.ca/news",
]


def collect(now_iso: str, *, live: bool = False, cached: list[dict] | None = None) -> list[dict[str, Any]]:
    items = []
    rows = list(cached or []) + try_feeds(FEEDS, live=live)
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
            relatedUtility="driving",
            **location,
        )
        ok, reason = police_relevance(SOURCE, item)
        if not ok:
            continue
        items.append(item)
    return items
