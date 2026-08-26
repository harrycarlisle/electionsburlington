"""Discover YouTube URLs already present in Burlington News research files.

This is the lawful web/community fallback: reuse URLs the newsroom already collected.
It does not scrape Google or Reddit live.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
WATCH = re.compile(r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{6,})", re.I)


class ExistingUrlProvider:
    name = "existing_public_urls"
    kind = "VideoDiscoveryProvider"

    def discover(self, paths: list[Path] | None = None) -> list[dict[str, Any]]:
        found = []
        seen = set()
        for path in paths or _default_paths():
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            for match in WATCH.finditer(text):
                video_id = match.group(1)
                if video_id in seen:
                    continue
                seen.add(video_id)
                found.append({
                    "videoId": video_id,
                    "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
                    "title": "",
                    "description": f"Mentioned in {path.relative_to(ROOT)}",
                    "channel": "",
                    "publishedAt": "",
                    "views": 0,
                    "likes": 0,
                    "discoverySource": self.name,
                })
        return found


def _default_paths() -> list[Path]:
    files = []
    skip = {"video-leads.json", "video-leads-config.json"}
    for folder in (ROOT / "data", ROOT / "monitoring"):
        if folder.exists():
            files.extend(path for path in folder.rglob("*.json") if path.name not in skip)
            files.extend(folder.rglob("*.md"))
    return files
