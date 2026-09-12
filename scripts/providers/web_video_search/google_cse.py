"""Official Google Programmable Search (Custom Search JSON API).

Inactive unless GOOGLE_CSE_KEY and GOOGLE_CSE_CX are set server-side.
Does not scrape Google HTML, page through blocked results, or rotate proxies.
"""

from __future__ import annotations

import os
import urllib.parse
from typing import Any

from sources.fetch import fetch_json


class GoogleCseVideoProvider:
    name = "google_cse_video"
    kind = "VideoDiscoveryProvider"

    def __init__(self, api_key: str | None = None, cx: str | None = None, fetch=fetch_json):
        self.api_key = (api_key if api_key is not None else os.environ.get("GOOGLE_CSE_KEY", "")).strip()
        self.cx = (cx if cx is not None else os.environ.get("GOOGLE_CSE_CX", "")).strip()
        self.fetch = fetch

    def available(self) -> bool:
        return bool(self.api_key and self.cx)

    def discover_keywords(self, keywords: dict[str, list[str]]) -> list[dict[str, Any]]:
        if not self.available():
            return []
        queries = []
        for group in keywords.values():
            queries.extend(group[:2])
        videos = []
        for query in queries[:6]:
            videos.extend(self.search(query, max_results=3))
        return videos

    def search(self, query: str, max_results: int = 3) -> list[dict[str, Any]]:
        if not self.available():
            return []
        params = {
            "key": self.api_key,
            "cx": self.cx,
            "q": f"{query} site:youtube.com/watch",
            "num": max(1, min(int(max_results), 5)),
            "safe": "active",
        }
        url = "https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode(params)
        try:
            data = self.fetch(url, timeout=15)
        except Exception:
            return []
        found = []
        for item in data.get("items") or []:
            link = item.get("link") or ""
            video_id = _video_id(link)
            if not video_id:
                continue
            found.append({
                "videoId": video_id,
                "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
                "title": item.get("title") or "",
                "description": (item.get("snippet") or "")[:400],
                "channel": "",
                "publishedAt": "",
                "views": 0,
                "likes": 0,
                "discoverySource": self.name,
                "searchQuery": query,
            })
        return found


def _video_id(url: str) -> str:
    if "youtube.com/watch" in url and "v=" in url:
        return url.split("v=", 1)[1].split("&", 1)[0][:16]
    if "youtu.be/" in url:
        return url.split("youtu.be/", 1)[1].split("?", 1)[0][:16]
    return ""
