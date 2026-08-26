"""Shared quick-update object used by Breaking Now, live utilities and the discovery queue."""

from __future__ import annotations

import hashlib
import re
from typing import Any

SCHEMA_FIELDS = (
    "id",
    "headline",
    "shortHeadline",
    "category",
    "summary",
    "location",
    "nearestIntersection",
    "affectedArea",
    "publishedAt",
    "updatedAt",
    "discoveredAt",
    "severity",
    "impactScore",
    "confidenceScore",
    "localRelevance",
    "recencyScore",
    "breadthScore",
    "noveltyScore",
    "publicNeedScore",
    "breakingScore",
    "sourceType",
    "sourceName",
    "sourceUrl",
    "verificationStatus",
    "relatedUtility",
    "cause",
    "status",
    "expiresAt",
    "storyUrl",
    "eventType",
    "city",
    "region",
    "rawText",
    "relatedSources",
    "label",
    "rejectReason",
)


def slug_id(*parts: str) -> str:
    raw = "|".join(str(part or "").strip().lower() for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return digest


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def short_headline(value: str, limit: int = 88) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def quick_update(**fields: Any) -> dict:
    item = {key: None for key in SCHEMA_FIELDS}
    item["relatedSources"] = []
    item.update({key: value for key, value in fields.items() if key in item or True})
    headline = clean_text(item.get("headline") or item.get("title") or "")
    item["headline"] = headline
    item["shortHeadline"] = clean_text(item.get("shortHeadline") or "") or short_headline(headline)
    item["summary"] = clean_text(item.get("summary") or item.get("description") or "")
    item["rawText"] = clean_text(item.get("rawText") or f"{headline} {item['summary']}")
    if not item.get("id"):
        item["id"] = slug_id(item.get("sourceName") or "", item.get("sourceUrl") or "", headline)
    if item.get("relatedSources") is None:
        item["relatedSources"] = []
    return item
