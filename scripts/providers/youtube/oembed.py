"""Official YouTube oEmbed. Public metadata only."""

from __future__ import annotations

import urllib.parse
from typing import Any

from sources.fetch import fetch_json


def hydrate(video: dict[str, Any], fetch=fetch_json) -> dict[str, Any]:
    url = video.get("videoUrl") or ""
    if not url:
        return video
    endpoint = "https://www.youtube.com/oembed?" + urllib.parse.urlencode({"url": url, "format": "json"})
    try:
        data = fetch(endpoint, timeout=12)
    except Exception:
        return video
    video["title"] = video.get("title") or data.get("title") or ""
    video["channel"] = video.get("channel") or data.get("author_name") or ""
    return video
