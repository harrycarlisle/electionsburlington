#!/usr/bin/env python3
"""Render the homepage using live editorial rules without mutating base ranking code."""
from __future__ import annotations

import datetime as dt
import re

import render_homepage as base

FRESH_LOCAL_MAX_AGE = dt.timedelta(hours=18)
UTILITY_CATEGORIES = {"traffic", "transit", "weather", "roads"}
GENERIC_IMAGES = {"/assets/editorial/home-share.webp", "assets/editorial/home-share.webp"}


def display_headline(value) -> str:
    """Homepage article cards do not end in a full stop; ? and ! remain intact."""
    return re.sub(r"\.+$", "", str(value or "").strip())


def display_item(item: dict) -> dict:
    row = dict(item)
    if row.get("headline"):
        row["headline"] = display_headline(row.get("headline"))
    if row.get("shortHeadline"):
        row["shortHeadline"] = display_headline(row.get("shortHeadline"))
    return row


def editorial_family(item: dict) -> str:
    value = " ".join(
        str(item.get(key) or "").strip().lower()
        for key in ("editorialFamily", "kind", "label", "category", "topic")
    )
    if re.search(r"home rules|permit|parking|bylaw|service", value):
        return "service"
    if re.search(r"public safety|police|crime|shooting|fire", value):
        return "public-safety"
    if re.search(r"traffic|transport|road|qew|collision", value):
        return "traffic"
    if re.search(r"history|mystery|heritage", value):
        return "history"
    if re.search(r"development|construction|housing", value):
        return "development"
    if re.search(r"food|restaurant|drink", value):
        return "food"
    if "sport" in value:
        return "sports"
    if re.search(r"event|festival", value):
        return "events"
    if re.search(r"school|education", value):
        return "schools"
    if re.search(r"election|council|politic", value):
        return "civic"
    return str(item.get("topic") or item.get("category") or item.get("label") or item.get("id") or "other").lower()


def pick_diverse(items: list[dict], limit: int) -> list[dict]:
    picked: list[dict] = []
    families: set[str] = set()
    for item in items:
        family = editorial_family(item)
        if family in families:
            continue
        picked.append(display_item(item))
        families.add(family)
        if len(picked) >= limit:
            break
    return picked


def has_meaningful_update(item: dict) -> bool:
    published = base.parse_time(item.get("publishedAt") or item.get("datePublished"))
    updated = base.parse_time(item.get("lastMeaningfulUpdate") or item.get("meaningfulUpdatedAt"))
    return bool(published and updated and updated > published + dt.timedelta(minutes=5))


def has_why_now(item: dict) -> bool:
    if item.get("localUpdateEligible") is False:
        return False
    if item.get("anniversaryMatch"):
        return True
    if item.get("localUpdateReason") or item.get("contextSignal") or item.get("relatedCurrentEvent"):
        return True
    if has_meaningful_update(item):
        return True
    source = str(item.get("sourceName") or "").strip().lower()
    if source == "burlington news":
        return False
    return bool(source)


def local_rank(item: dict) -> float:
    base_score = float(item.get("localUpdateScore") or 0)
    if item.get("anniversaryMatch"):
        return base_score + 4.0
    if item.get("localUpdateReason") or item.get("contextSignal") or item.get("relatedCurrentEvent"):
        return base_score + 3.5
    if has_meaningful_update(item):
        return base_score + 2.5
    return base_score + 1.0


def is_editorial_story(item: dict) -> bool:
    category = str(item.get("category") or item.get("topic") or item.get("label") or "").strip().lower()
    image = base.image_url(item)
    return bool(
        item.get("headline")
        and base.public_url(item)
        and image
        and category not in UTILITY_CATEGORIES
        and image not in GENERIC_IMAGES
    )


def selected_breaking_visible(live: dict, archive: dict, now: dt.datetime) -> list[dict]:
    current = [
        row for row in (live.get("items") or [])
        if isinstance(row, dict)
        and row.get("headline")
        and base.public_url(row)
        and base.age(row, now) <= FRESH_LOCAL_MAX_AGE
    ]
    current = base.unique(current)

    if live.get("mode") == "breaking":
        current.sort(
            key=lambda row: base.timestamp(row) or dt.datetime.min.replace(tzinfo=base.TZ),
            reverse=True,
        )
        return pick_diverse(current, 2)

    # Local Update is intentionally not backfilled from the breaking archive.
    # It needs an explicit why-now reason or a genuinely fresh external update.
    local = [row for row in current if has_why_now(row)]
    local.sort(
        key=lambda row: (
            local_rank(row),
            base.timestamp(row) or dt.datetime.min.replace(tzinfo=base.TZ),
        ),
        reverse=True,
    )
    return pick_diverse(local, 2)


def editorial_hero(home: dict, live: dict, archive: dict, now: dt.datetime):
    if live.get("mode") == "breaking":
        for item in live.get("items") or []:
            if is_editorial_story(item):
                return display_item(item)

    recent_archive = [
        item for item in (archive.get("items") or [])
        if is_editorial_story(item)
        and base.age(item, now) <= base.RECENT_ARCHIVE_HERO_MAX_AGE
    ]
    recent_archive.sort(
        key=lambda item: base.timestamp(item) or dt.datetime.min.replace(tzinfo=base.TZ),
        reverse=True,
    )
    if recent_archive:
        return display_item(recent_archive[0])

    for item in home.get("feature") or []:
        if is_editorial_story(item):
            return display_item(item)
    for item in home.get("latest") or []:
        if is_editorial_story(item):
            return display_item(item)
    return None


def diverse_newest_items(home: dict, archive: dict, hero: dict | None, now: dt.datetime) -> list[dict]:
    # Newest is an editorial list, not a replay of the breaking archive.
    pool = base.unique(
        list(home.get("latest") or [])
        + list(home.get("rail") or [])
        + list(home.get("feature") or [])
    )
    hero_key = base.story_key(hero or {})
    rows = [
        item for item in pool
        if base.story_key(item) != hero_key
        and item.get("headline")
        and base.public_url(item)
        and base.timestamp(item)
        and base.age(item, now) <= base.NEWEST_MAX_AGE
        and base.clean(item.get("status")).lower() != "expired"
    ]
    rows.sort(
        key=lambda item: base.timestamp(item) or dt.datetime.min.replace(tzinfo=base.TZ),
        reverse=True,
    )
    return pick_diverse(rows, 3)


def main() -> int:
    base.LOCAL_UPDATE_MAX_AGE = FRESH_LOCAL_MAX_AGE
    base.breaking_visible = selected_breaking_visible
    base.choose_hero = editorial_hero
    base.newest_items = diverse_newest_items
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
