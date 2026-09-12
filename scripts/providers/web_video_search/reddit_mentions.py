"""Reddit is a discovery signal, never verification.

Reads YouTube URLs already stored in newsroom files. Does not live-scrape
Reddit, bypass rate limits, or treat a thread as a fact source.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
WATCH = re.compile(r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{6,})", re.I)


class RedditMentionProvider:
    name = "reddit_mentions"
    kind = "VideoDiscoveryProvider"

    def discover(self, paths: list[Path] | None = None) -> list[dict[str, Any]]:
        found = []
        seen = set()
        for path in paths or _default_paths():
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if "reddit" not in text.lower() and "reddit" not in path.name.lower():
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
                    "description": f"Mentioned in Reddit-derived file {path.relative_to(ROOT)}. Signal only, not verification.",
                    "channel": "",
                    "publishedAt": "",
                    "views": 0,
                    "likes": 0,
                    "discoverySource": self.name,
                })
        return found


def _default_paths() -> list[Path]:
    files = []
    for name in ("community-pulse.json", "discovery-queue.json", "editorial-queue.json"):
        path = ROOT / "data" / name
        if path.exists():
            files.append(path)
    monitoring = ROOT / "monitoring"
    if monitoring.exists():
        files.extend(monitoring.rglob("*.md"))
        files.extend(monitoring.rglob("*.json"))
    return files
