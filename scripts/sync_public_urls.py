#!/usr/bin/env python3
"""Publish clean GitHub Pages URLs without destroying the existing .html files.

Directory indexes become the public paths. Original .html files stay in place so
old links keep working. Canonical tags on the source pages already point at the
clean URLs.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write_copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


def main() -> int:
    # /news/ has its own live archive layout. Do not overwrite it with the
    # legacy updates.html page when the hourly publishing job syncs clean URLs.
    pairs = [
        (ROOT / "explore.html", ROOT / "explore" / "index.html"),
        (ROOT / "election-guide.html", ROOT / "elections" / "index.html"),
        (ROOT / "skyway-traffic.html", ROOT / "traffic" / "index.html"),
        (ROOT / "sports.html", ROOT / "sports" / "index.html"),
        (ROOT / "puzzles.html", ROOT / "games" / "index.html"),
    ]
    for src, dest in pairs:
        write_copy(src, dest)
    count = 0
    for article in sorted((ROOT / "articles").glob("*.html")) + sorted((ROOT / "articles" / "auto").glob("*.html")):
        write_copy(article, ROOT / "stories" / article.stem / "index.html")
        count += 1
    print(f"Published {len(pairs)} section URLs and {count} story URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
