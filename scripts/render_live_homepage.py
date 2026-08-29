#!/usr/bin/env python3
"""Render the homepage using the live rail's selected items first.

The live news rail may carry traffic/transit/weather alerts, but utility notices
must not replace the editorial homepage hero with a generic card. The hero stays
an actual reported story unless a non-utility breaking story with a real image
is available.
"""
from __future__ import annotations

import datetime as dt

import render_homepage as base

FRESH_LOCAL_MAX_AGE = dt.timedelta(hours=18)
UTILITY_CATEGORIES = {"traffic", "transit", "weather", "roads"}
GENERIC_IMAGES = {"/assets/editorial/home-share.webp", "assets/editorial/home-share.webp"}


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
    current.sort(key=lambda row: base.timestamp(row) or dt.datetime.min.replace(tzinfo=base.TZ), reverse=True)
    if current:
        return current[:2]

    old = [
        row for row in (archive.get("items") or [])
        if isinstance(row, dict)
        and row.get("headline")
        and base.public_url(row)
        and base.age(row, now) <= FRESH_LOCAL_MAX_AGE
    ]
    old = base.unique(old)
    old.sort(key=lambda row: base.timestamp(row) or dt.datetime.min.replace(tzinfo=base.TZ), reverse=True)
    return old[:2]


def editorial_hero(home: dict, live: dict, archive: dict, now: dt.datetime):
    if live.get("mode") == "breaking":
        for item in live.get("items") or []:
            if is_editorial_story(item):
                return item

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
        return recent_archive[0]

    for item in home.get("feature") or []:
        if is_editorial_story(item):
            return item
    for item in home.get("latest") or []:
        if is_editorial_story(item):
            return item
    return None


def main() -> int:
    base.LOCAL_UPDATE_MAX_AGE = FRESH_LOCAL_MAX_AGE
    base.breaking_visible = selected_breaking_visible
    base.choose_hero = editorial_hero
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
