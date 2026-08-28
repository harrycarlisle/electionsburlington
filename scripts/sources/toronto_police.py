"""Toronto Police Service — reject routine city incidents."""

from __future__ import annotations

from typing import Any

from .fetch import try_feeds
from .model import quick_update
from .relevance import extract_location, police_relevance

SOURCE = "Toronto Police Service"
FEEDS = [
    "https://www.tps.ca/media-room/rss",
    "https://www.tps.ca/media-releases/",
]


def collect(now_iso: str, *, live: bool = False, cached: list[dict] | None = None) -> list[dict[str, Any]]:
    items = []
    for raw in list(cached or []) + try_feeds(FEEDS, live=live):
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
            publishedAt=raw.get("publishedAt") or raw.get("published") or "",
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            city=location.get("city") or "Toronto",
            **{k: v for k, v in location.items() if k != "city"},
        )
        ok, _reason = police_relevance(SOURCE, item)
        if not ok:
            continue
        items.append(item)
    return items
