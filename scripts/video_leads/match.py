"""Conservative text matching for video leads.

Short tokens must be whole words. Entity aliases are checked against the
title and the start of the description, not a long news-channel footer.
"""

from __future__ import annotations

import re


def hay_for_entity(video: dict, description_chars: int = 240) -> str:
    description = str(video.get("description") or "")[:description_chars]
    return " ".join([
        str(video.get("title") or ""),
        description,
        str(video.get("channel") or ""),
    ]).lower()


def hay_for_score(video: dict) -> str:
    return " ".join([
        str(video.get("title") or ""),
        str(video.get("description") or "")[:240],
        str(video.get("channel") or ""),
        " ".join(video.get("watchlistTopics") or []),
        str(video.get("watchlistRegion") or ""),
    ]).lower()


def alias_hit(hay: str, alias: str) -> bool:
    alias = (alias or "").strip().lower()
    hay = hay or ""
    if not alias:
        return False
    if " " in alias:
        return alias in hay
    if len(alias) <= 4:
        return bool(re.search(rf"\b{re.escape(alias)}\b", hay))
    return alias in hay


def any_alias(hay: str, aliases: tuple[str, ...] | list[str]) -> bool:
    return any(alias_hit(hay, alias) for alias in aliases)
