"""Hamilton Police Service — Burlington-relevant by default, regional fallback on request."""

from __future__ import annotations

import datetime as dt
import html
import re
from typing import Any
from zoneinfo import ZoneInfo

from .fetch import fetch_text, try_feeds
from .model import quick_update
from .relevance import extract_location, police_relevance

SOURCE = "Hamilton Police Service"
TZ = ZoneInfo("America/Toronto")
FEEDS = [
    "https://hamiltonpolice.on.ca/news/feed",
    "https://hamiltonpolice.ca/news/feed",
    "https://hamiltonpolice.on.ca/news",
]


def _plain(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def _meta(body: str, key: str) -> str:
    patterns = [
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, body, flags=re.I)
        if match:
            return html.unescape(match.group(1)).strip()
    return ""


def _visible_hamilton_time(body: str) -> str:
    match = re.search(
        r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s*\|\s*(\d{1,2}:\d{2})\b",
        _plain(body),
        flags=re.I,
    )
    if not match:
        return ""
    raw = f"{match.group(1)} {match.group(2)} {match.group(3)} {match.group(4)}"
    try:
        return dt.datetime.strptime(raw, "%d %B %Y %H:%M").replace(tzinfo=TZ).isoformat()
    except ValueError:
        return ""


def _article_details(url: str) -> dict[str, str]:
    if not url or not re.match(r"^https?://(?:www\.)?hamiltonpolice\.(?:on\.ca|ca)/", url, flags=re.I):
        return {}
    try:
        body = fetch_text(url)
    except Exception:
        return {}

    published = _meta(body, "article:published_time")
    if not published:
        time_match = re.search(r'<time[^>]+datetime=["\']([^"\']+)["\']', body, flags=re.I)
        published = time_match.group(1).strip() if time_match else ""
    if not published:
        published = _visible_hamilton_time(body)

    paragraphs = []
    for match in re.finditer(r"<p\b[^>]*>(.*?)</p>", body, flags=re.I | re.S):
        text = _plain(match.group(1))
        lower = text.lower()
        if len(text) < 45 or any(term in lower for term in ("cookie", "privacy", "subscribe", "copyright")):
            continue
        paragraphs.append(text)
        if len(paragraphs) >= 3:
            break
    summary = paragraphs[0] if paragraphs else _meta(body, "description")
    return {"publishedAt": published, "summary": summary}


def collect(
    now_iso: str,
    *,
    live: bool = False,
    cached: list[dict] | None = None,
    include_regional: bool = False,
) -> list[dict[str, Any]]:
    """Collect Hamilton Police items.

    Normal callers receive only events that pass Burlington relevance. The
    Breaking/Local Update refresh job can request ``include_regional`` so a
    fresh, significant Hamilton item may be used only as a last-resort regional
    Local Update when Burlington/Halton has gone quiet. Those rows are marked
    ``regionalFallback`` and are never intended to qualify as Breaking News.
    """
    rows = list(cached or [])
    for raw in try_feeds(FEEDS, live=live):
        rows.append(raw)
    items = []
    details_cache: dict[str, dict[str, str]] = {}
    for raw in rows:
        headline = raw.get("title") or raw.get("headline") or ""
        if not headline:
            continue
        source_url = raw.get("url") or raw.get("sourceUrl") or ""
        summary = raw.get("summary") or ""
        published = raw.get("publishedAt") or ""
        if live and source_url and (not published or not summary):
            details = details_cache.setdefault(source_url, _article_details(source_url))
            published = published or details.get("publishedAt") or ""
            summary = summary or details.get("summary") or ""
        location = extract_location(f"{headline} {summary}")
        item = quick_update(
            headline=headline,
            summary=summary,
            category="PUBLIC SAFETY",
            eventType="police",
            sourceType="official",
            sourceName=SOURCE,
            sourceUrl=source_url,
            # Unknown source time stays unknown. Discovery time must never be
            # presented or scored as if it were the publication/update time.
            publishedAt=published,
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            city=location.get("city") or "Hamilton",
            **{k: v for k, v in location.items() if k != "city"},
        )
        ok, reason = police_relevance(SOURCE, item)
        if not ok:
            item["rejectReason"] = reason
            if not include_regional:
                continue
            item["regionalFallback"] = True
            # Deliberately below direct Burlington/Halton relevance. This only
            # lets the regional fallback compete after the normal rail is stale.
            item["localRelevance"] = 2.5
        items.append(item)
    return items
