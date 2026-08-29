#!/usr/bin/env python3
"""Render the homepage using the live rail's selected items first.

The base renderer keeps a recent archive as a resilience fallback. For the live
Local Update rail, however, a current selector result must not be padded with a
stale archived story. We use the archive only when the selector produced no
usable current items at all.
"""
from __future__ import annotations

import datetime as dt

import render_homepage as base

FRESH_LOCAL_MAX_AGE = dt.timedelta(hours=18)


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


def main() -> int:
    base.LOCAL_UPDATE_MAX_AGE = FRESH_LOCAL_MAX_AGE
    base.breaking_visible = selected_breaking_visible
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
