"""Established regional newsrooms already collected by civic watch."""

from __future__ import annotations

from typing import Any

from .model import quick_update
from .relevance import burlington_relevance

NEWSROOMS = (
    "CHCH", "CBC", "BurlingtonToday", "InsideHalton", "Hamilton Spectator",
    "The Spec", "CP24",
)


def collect(now_iso: str, monitor: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    items = []
    for raw in (monitor or {}).get("items") or []:
        source = str(raw.get("source") or "")
        if not any(name.lower() in source.lower() for name in NEWSROOMS):
            continue
        if not raw.get("verified"):
            continue
        headline = raw.get("title") or raw.get("headline") or ""
        item = quick_update(
            headline=headline,
            summary=raw.get("description") or "",
            category="NEWS",
            eventType="reporting",
            sourceType="reporting",
            sourceName=source,
            sourceUrl=raw.get("url") or "",
            publishedAt=raw.get("published") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="reported",
            confidenceScore=4.0,
            storyUrl="",
        )
        if burlington_relevance(item) < 2.4:
            continue
        items.append(item)
    return items
