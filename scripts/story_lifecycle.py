#!/usr/bin/env python3
"""Shared lifecycle rules for time-sensitive Burlington News stories.

Freshness and urgency are separate. A newly posted resolution can be a useful
Local Update, but it must not continue to look like an active emergency or take
over the homepage hero.
"""

from __future__ import annotations

import datetime as dt
import re
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Toronto")

RESOLVED_VALUES = {
    "complete",
    "completed",
    "ended",
    "inactive",
    "reopened",
    "resolved",
    "restored",
}

ACTIVE_VALUES = {
    "active",
    "breaking",
    "closed",
    "developing",
    "ongoing",
    "open",
}

RESOLUTION_PATTERNS = (
    re.compile(r"\b(?:has been|have been|was|were|is now|are now)?\s*(?:cleared|reopened|resolved|restored)\b", re.I),
    re.compile(r"\b(?:incident|response|scene|standoff|search|closure)\s+(?:has\s+)?(?:ended|is over|was cleared)\b", re.I),
    re.compile(r"\b(?:taken into|remains in) custody\b", re.I),
    re.compile(r"\b(?:suspect|person|driver|accused)\s+(?:has been|was|is)\s+(?:arrested|apprehended|located)\b", re.I),
    re.compile(r"\bno (?:longer an|ongoing|further) (?:danger|risk|threat)\b", re.I),
    re.compile(r"\bservice (?:has )?resumed\b", re.I),
    re.compile(r"\b(?:all )?lanes (?:have )?(?:reopened|cleared)\b", re.I),
)


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized(value: object) -> str:
    return re.sub(r"[^a-z]+", "-", clean(value).lower()).strip("-")


def lifecycle_text(item: dict) -> str:
    return " ".join(
        clean(item.get(key))
        for key in (
            "headline",
            "shortHeadline",
            "summary",
            "deck",
            "description",
            "statusDetail",
            "resolution",
        )
        if item.get(key)
    )


def lifecycle_status(item: dict) -> str:
    """Return ``active``, ``resolved`` or ``developing`` for a story row."""
    if item.get("resolved") is True or item.get("isResolved") is True:
        return "resolved"
    if item.get("isActive") is False or item.get("active") is False:
        return "resolved"

    explicit = [
        normalized(item.get(key))
        for key in ("lifecycleStatus", "incidentStatus", "eventStatus", "status")
        if item.get(key) is not None
    ]
    if any(value in RESOLVED_VALUES for value in explicit):
        return "resolved"

    text = lifecycle_text(item)
    if any(pattern.search(text) for pattern in RESOLUTION_PATTERNS):
        return "resolved"
    if any(value in ACTIVE_VALUES for value in explicit):
        return "active"
    return "developing"


def is_resolved(item: dict) -> bool:
    return lifecycle_status(item) == "resolved"


def parse_time(value: object) -> dt.datetime | None:
    raw = clean(value)
    if not raw:
        return None
    try:
        if len(raw) == 10 and raw[4] == "-":
            return dt.datetime.fromisoformat(raw).replace(hour=12, tzinfo=TZ)
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except ValueError:
        return None


def update_time(item: dict) -> dt.datetime | None:
    for key in (
        "lastMeaningfulUpdate",
        "meaningfulUpdatedAt",
        "updatedAt",
        "publishedAt",
        "datePublished",
    ):
        parsed = parse_time(item.get(key))
        if parsed:
            return parsed
    return None


def has_newer_update(incoming: dict, existing: dict, minimum_minutes: int = 5) -> bool:
    current = update_time(existing)
    candidate = update_time(incoming)
    if not candidate:
        return False
    if not current:
        return True
    return candidate > current + dt.timedelta(minutes=minimum_minutes)
