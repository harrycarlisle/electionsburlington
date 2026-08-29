#!/usr/bin/env python3
"""Small safety pass for live-rail links after selection.

When Burlington News has a durable story page for the same source, the live rail
should link to that story. Otherwise traffic items go to Burlington News Traffic
and other verified unmatched items may link to their public source.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "breaking-now.json"
ARTICLES = ROOT / "articles"
STORIES = ROOT / "stories"


def internal_story_for_source(source_url: str) -> str:
    """Return a Burlington News route when a published story cites this source."""
    source_key = str(source_url or "").strip().rstrip("/")
    if not source_key.startswith(("https://", "http://")):
        return ""

    candidates = list(STORIES.glob("*/index.html"))
    candidates += list(ARTICLES.glob("*.html"))
    candidates += list((ARTICLES / "auto").glob("*.html"))

    for page in candidates:
        try:
            content = page.read_text(encoding="utf-8")
        except OSError:
            continue
        if source_key not in content:
            continue

        canonical = re.search(
            r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']https://burlingtonnews\.ca([^"\']+)["\']',
            content,
            re.I,
        )
        if canonical:
            return canonical.group(1)
        if page.name == "index.html" and page.parent.parent.name == "stories":
            return f"/stories/{page.parent.name}/"
        if page.parent == ARTICLES:
            return f"/articles/{page.name}"
        if page.parent == ARTICLES / "auto":
            return f"/articles/auto/{page.name}"
    return ""


def main() -> int:
    payload = json.loads(PATH.read_text(encoding="utf-8"))
    changed = False
    for item in payload.get("items") or []:
        current = str(item.get("storyUrl") or "")
        source = str(item.get("sourceName") or "").lower()
        category = str(item.get("category") or "").lower()
        source_url = str(item.get("sourceUrl") or "")

        internal = internal_story_for_source(source_url)
        if internal:
            target = internal
        elif current not in {"", "/news/", "/live/"} and not current.startswith("/live/?"):
            continue
        elif "ontario 511" in source or category == "traffic":
            target = "/traffic/"
        elif source_url.startswith(("https://", "http://", "/")):
            target = source_url
        else:
            target = "/news/"

        if target != current:
            item["storyUrl"] = target
            changed = True
    if changed:
        PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Live rail destinations normalized")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
