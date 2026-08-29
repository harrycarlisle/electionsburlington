#!/usr/bin/env python3
"""Small safety pass for live-rail links after selection.

Unmatched official updates should not dump readers on the generic News page.
Traffic items go to Burlington News Traffic; other verified unmatched items may
link to their public source until Burlington News has a durable story page.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "breaking-now.json"


def main() -> int:
    payload = json.loads(PATH.read_text(encoding="utf-8"))
    changed = False
    for item in payload.get("items") or []:
        current = str(item.get("storyUrl") or "")
        if current not in {"", "/news/", "/live/"} and not current.startswith("/live/?"):
            continue
        source = str(item.get("sourceName") or "").lower()
        category = str(item.get("category") or "").lower()
        source_url = str(item.get("sourceUrl") or "")
        if "ontario 511" in source or category == "traffic":
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
