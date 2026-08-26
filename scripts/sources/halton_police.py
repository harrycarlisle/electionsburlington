"""Halton Regional Police Service — official newsroom discovery."""

from __future__ import annotations

from typing import Any

from .fetch import try_feeds
from .model import quick_update
from .relevance import extract_location, police_relevance

SOURCE = "Halton Regional Police"
FEEDS = [
    "https://www.haltonpolice.ca/news-releases/feed/",
    "https://www.haltonpolice.ca/news-releases/media-releases/feed/",
    "https://www.haltonpolice.ca/news-releases/media-releases/",
    "https://www.haltonpolice.ca/news-releases/",
]


def collect(now_iso: str, *, live: bool = False, cached: list[dict] | None = None) -> list[dict[str, Any]]:
    rows = list(cached or [])
    for raw in try_feeds(FEEDS, live=live):
        rows.append(raw)
    items = []
    for raw in rows:
        headline = raw.get("title") or raw.get("headline") or ""
        url = raw.get("url") or raw.get("sourceUrl") or ""
        if not headline:
            continue
        location = extract_location(f"{headline} {raw.get('summary') or ''}")
        item = quick_update(
            headline=headline,
            summary=raw.get("summary") or raw.get("description") or "",
            category="PUBLIC SAFETY",
            eventType="police",
            sourceType="official",
            sourceName=SOURCE,
            sourceUrl=url,
            publishedAt=raw.get("publishedAt") or raw.get("published") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            relatedUtility="driving" if any(term in headline.lower() for term in ("qew", "collision", "road", "closed")) else "",
            storyUrl="",
            **location,
        )
        ok, reason = police_relevance(SOURCE, item)
        if not ok:
            item["rejectReason"] = reason
            continue
        items.append(item)
    return items
