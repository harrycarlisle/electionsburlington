#!/usr/bin/env python3
"""Merge editor-approved manual stories into the generated story catalog.

The catalog is also maintained by automated editorial jobs. Keeping manually
published stories in a small source file prevents those jobs from accidentally
removing an approved article while preserving the existing ranking pipeline.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "story-catalog.json"
MANUAL_PATH = ROOT / "data" / "manual-stories.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def validate_story(item: Any) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError("Each manual story must be a JSON object")

    required = ("id", "headline", "url", "gates")
    missing = [key for key in required if not item.get(key)]
    if missing:
        raise ValueError(
            f"Manual story is missing required fields: {', '.join(missing)}"
        )

    gates = item.get("gates")
    if not isinstance(gates, dict):
        raise ValueError(f"Manual story {item['id']} must include gate results")

    required_gates = ("evidence", "burlington", "imageRights", "duplicate")
    failed = [key for key in required_gates if gates.get(key) != "passed"]
    if failed:
        raise ValueError(
            f"Manual story {item['id']} has gates that are not passed: "
            + ", ".join(failed)
        )

    return item


def main() -> None:
    if not MANUAL_PATH.exists():
        return

    catalog = load_json(CATALOG_PATH)
    manual = load_json(MANUAL_PATH)

    catalog_items = catalog.get("items", [])
    manual_items = manual.get("items", [])
    if not isinstance(catalog_items, list) or not isinstance(manual_items, list):
        raise ValueError("Both story files must contain an items array")

    approved = [validate_story(item) for item in manual_items]
    manual_ids = {item["id"] for item in approved}

    catalog["items"] = approved + [
        item
        for item in catalog_items
        if isinstance(item, dict) and item.get("id") not in manual_ids
    ]

    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Merged {len(approved)} manually published stor{'y' if len(approved) == 1 else 'ies'}")


if __name__ == "__main__":
    main()
