#!/usr/bin/env python3
"""Remove duplicate legacy redirect tags created by repeated indexing passes."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTICLE_DIRS = [ROOT / "articles", ROOT / "articles" / "auto"]

REFRESH = re.compile(
    r"\s*<meta\b(?=[^>]*\bdata-legacy-source-redirect(?:\s|=|>))"
    r"(?=[^>]*\bhttp-equiv=[\"']refresh[\"'])[^>]*>",
    re.I,
)
SCRIPT = re.compile(
    r"\s*<script\b(?=[^>]*\bdata-legacy-source-redirect(?:\s|=|>))[^>]*>"
    r"\s*location\.replace\([^;]*\);?\s*</script>",
    re.I | re.S,
)


def keep_first(doc: str, pattern: re.Pattern[str]) -> tuple[str, int]:
    matches = list(pattern.finditer(doc))
    if len(matches) <= 1:
        return doc, 0
    removed = 0
    for match in reversed(matches[1:]):
        doc = doc[: match.start()] + doc[match.end() :]
        removed += 1
    return doc, removed


def main() -> int:
    files_changed = 0
    tags_removed = 0
    seen: set[Path] = set()
    for directory in ARTICLE_DIRS:
        for path in sorted(directory.glob("*.html")):
            if path in seen:
                continue
            seen.add(path)
            before = path.read_text(encoding="utf-8")
            after, refresh_removed = keep_first(before, REFRESH)
            after, script_removed = keep_first(after, SCRIPT)
            removed = refresh_removed + script_removed
            if removed:
                path.write_text(after, encoding="utf-8")
                files_changed += 1
                tags_removed += removed
    print(f"Legacy redirect dedupe OK: {tags_removed} duplicate tags removed from {files_changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
