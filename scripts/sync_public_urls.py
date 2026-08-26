#!/usr/bin/env python3
"""Retired. Directory indexes are now the source of truth.

Do not copy articles/*.html onto stories/*/index.html. Those .html files
are long-lived redirect stubs. See redirects.json and docs/url-migration.md.
"""

from __future__ import annotations


def main() -> int:
    print("sync_public_urls.py is retired.")
    print("Clean URLs live in directory indexes. Legacy .html files are redirect stubs.")
    print("See redirects.json and docs/url-migration.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
