#!/usr/bin/env python3
"""Publish clean GitHub Pages URLs while keeping legacy source files non-indexable.

Directory indexes are the public paths. Original `.html` files stay in place as
source/legacy URLs. Search-indexing hygiene marks those legacy article files
`noindex` and gives them browser redirects; those source-only tags are stripped
when the canonical `/stories/<slug>/` copy is generated.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write_copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


def public_story_html(src: Path) -> str:
    doc = src.read_text(encoding="utf-8")
    doc = re.sub(r"\s*<meta\b[^>]*data-legacy-source-redirect[^>]*>", "", doc, flags=re.I)
    doc = re.sub(
        r"\s*<script\b[^>]*data-legacy-source-redirect[^>]*>.*?</script>",
        "",
        doc,
        flags=re.I | re.S,
    )
    return doc


def write_story_copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(public_story_html(src), encoding="utf-8")


def main() -> int:
    # /news/ has its own live archive layout. Do not overwrite it with the
    # legacy updates.html page when the hourly publishing job syncs clean URLs.
    # Explore owns a live visual planner at /explore/. Its legacy explore.html
    # file is a redirect and must never overwrite the canonical page.
    pairs = [
        (ROOT / "election-guide.html", ROOT / "elections" / "index.html"),
        (ROOT / "skyway-traffic.html", ROOT / "traffic" / "index.html"),
        (ROOT / "sports.html", ROOT / "sports" / "index.html"),
        (ROOT / "puzzles.html", ROOT / "games" / "index.html"),
    ]
    for src, dest in pairs:
        write_copy(src, dest)
    count = 0
    for article in sorted((ROOT / "articles").glob("*.html")) + sorted((ROOT / "articles" / "auto").glob("*.html")):
        write_story_copy(article, ROOT / "stories" / article.stem / "index.html")
        count += 1
    print(f"Published {len(pairs)} section URLs and {count} story URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
