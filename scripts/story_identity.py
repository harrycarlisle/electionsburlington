"""Stable story identity for homepage placement.

Prefer, in order: story ID, canonical/normalized URL, slug, then headline.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

_PUNCT = re.compile(r"[^a-z0-9]+")
_ARTICLE_PREFIX = re.compile(r"^(?:articles|stories)(?:/auto)?/")


def normalize_url(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    raw = re.sub(r"^https?://[^/]+", "", raw, flags=re.I)
    raw = raw.split("?")[0].split("#")[0]
    raw = raw.replace("/index.html", "/")
    raw = raw.replace(".html", "")
    raw = re.sub(r"/+", "/", raw).strip("/")
    raw = _ARTICLE_PREFIX.sub("stories/", raw)
    if raw.startswith("stories/"):
        slug = raw.split("/", 1)[1]
        return f"stories/{slug.strip('/')}"
    return raw.lower()


def story_slug(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    explicit = str(item.get("slug") or "").strip().strip("/")
    if explicit:
        return explicit.lower()
    url = normalize_url(item.get("canonical") or item.get("url") or "")
    if url.startswith("stories/"):
        return url.split("/", 1)[1]
    return ""


def story_id(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    return str(item.get("id") or "").strip().lower()


def story_headline(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    return _PUNCT.sub(" ", str(item.get("headline") or "").lower()).strip()


def story_key(item: dict[str, Any] | None) -> str:
    if not item:
        return ""
    if story_id(item):
        return f"id:{story_id(item)}"
    if normalize_url(item.get("canonical") or item.get("url")):
        return f"url:{normalize_url(item.get('canonical') or item.get('url'))}"
    if story_slug(item):
        return f"slug:{story_slug(item)}"
    if story_headline(item):
        return f"headline:{story_headline(item)}"
    return ""


def same_story(left: dict[str, Any] | None, right: dict[str, Any] | None) -> bool:
    if not left or not right:
        return False
    left_id, right_id = story_id(left), story_id(right)
    if left_id and right_id and left_id == right_id:
        return True
    left_url = normalize_url(left.get("canonical") or left.get("url"))
    right_url = normalize_url(right.get("canonical") or right.get("url"))
    if left_url and right_url and left_url == right_url:
        return True
    left_slug, right_slug = story_slug(left), story_slug(right)
    if left_slug and right_slug and left_slug == right_slug:
        return True
    if left_id and right_id and left_id != right_id:
        return False
    left_headline, right_headline = story_headline(left), story_headline(right)
    return bool(left_headline and right_headline and left_headline == right_headline)


def unique_stories(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []
    for item in items:
        if item and not any(same_story(item, seen) for seen in unique):
            unique.append(item)
    return unique


def newest_without_hero(
    items: Iterable[dict[str, Any]],
    hero: dict[str, Any] | None,
    count: int = 4,
) -> list[dict[str, Any]]:
    """Keep incoming order. Dedupe, drop the hero, then take `count`."""
    return [item for item in unique_stories(items) if not same_story(item, hero)][:count]
