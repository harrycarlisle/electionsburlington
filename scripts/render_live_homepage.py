#!/usr/bin/env python3
"""Render the homepage using the live rail's selected items first.

The base renderer keeps a recent archive as a resilience fallback. For the live
Local Update rail, however, a current selector result must not be padded with a
stale archived story. We use the archive only when the selector produced no
usable current items at all.

Traffic/transit/weather alerts can belong in Breaking News, but they should not
replace the editorial homepage hero with a generic utility card or fallback
share image. The hero remains an actual reported story unless a non-utility
breaking story with a real image is available.
"""
from __future__ import annotations

import datetime as dt

import render_homepage as base

FRESH_LOCAL_MAX_AGE = dt.timedelta(hours=18)
UTILITY_CATEGORIES = {"traffic", "transit", "weather", "roads"}
GENERIC_IMAGES = {"/assets/editorial/home-share.webp", "assets/editorial/home-share.webp"}
ORIGINAL_CHOOSE_HERO = base.choose_hero


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
            category = str(item.get("category") or item.get("topic") or "").strip().lower()
            image = base.image_url(item)
            if category in UTILITY_CATEGORIES or image in GENERIC_IMAGES:
                continue
            if item.get("headline") and base.public_url(item) and image:
                return item

    # Ask the normal renderer to choose from recent archive / ranked homepage,
    # but prevent the utility Breaking mode from taking over the hero.
    safe_live = dict(live)
    safe_live["mode"] = "local_update"
    return ORIGINAL_CHOOSE_HERO(home, safe_live, archive, now)


def main() -> int:
    base.LOCAL_UPDATE_MAX_AGE = FRESH_LOCAL_MAX_AGE
    base.breaking_visible = selected_breaking_visible
    base.choose_hero = editorial_hero
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
