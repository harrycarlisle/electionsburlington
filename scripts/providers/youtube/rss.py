"""Official YouTube channel Atom feeds. No HTML scraping, no unofficial frontends."""

from __future__ import annotations

import datetime as dt
import xml.etree.ElementTree as ET
from typing import Any

from sources.fetch import fetch_text

ATOM = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
MEDIA = "{http://search.yahoo.com/mrss/}"


def _text(node: ET.Element | None) -> str:
    return (node.text or "").strip() if node is not None else ""


class YouTubeRssProvider:
    name = "youtube_rss"
    kind = "VideoDiscoveryProvider"

    def __init__(self, fetch=fetch_text):
        self.fetch = fetch

    def can_handle(self, channel_id: str) -> bool:
        return bool(channel_id) and channel_id.startswith("UC")

    def discover(self, channel: dict[str, Any], lookback_days: int = 80) -> list[dict[str, Any]]:
        channel_id = channel.get("channelId") or ""
        if not self.can_handle(channel_id):
            return []
        url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        try:
            body = self.fetch(url, timeout=18)
        except Exception:
            return []
        return self._parse(body, channel, lookback_days)

    def _parse(self, body: str, channel: dict[str, Any], lookback_days: int) -> list[dict[str, Any]]:
        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            return []
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=lookback_days)
        items = []
        for entry in root.findall(f"{ATOM}entry"):
            video_id = _text(entry.find(f"{YT}videoId"))
            title = _text(entry.find(f"{ATOM}title"))
            link = entry.find(f"{ATOM}link")
            url = (link.get("href") if link is not None else "") or (f"https://www.youtube.com/watch?v={video_id}" if video_id else "")
            published = _text(entry.find(f"{ATOM}published"))
            group = entry.find(f"{MEDIA}group")
            description = _text(group.find(f"{MEDIA}description")) if group is not None else ""
            community = group.find(f"{MEDIA}community") if group is not None else None
            views = 0
            likes = 0
            if community is not None:
                stats = community.find(f"{MEDIA}statistics")
                stars = community.find(f"{MEDIA}starRating")
                if stats is not None:
                    views = int(stats.get("views") or 0)
                if stars is not None:
                    likes = int(stars.get("count") or 0)
            published_dt = _parse_time(published)
            if published_dt and published_dt < cutoff:
                continue
            if not video_id or not title:
                continue
            items.append({
                "videoId": video_id,
                "videoUrl": url,
                "title": title,
                "description": description[:4000],
                "channel": channel.get("name") or _text(entry.find(f"{ATOM}author/{ATOM}name")),
                "channelId": channel.get("channelId") or _text(entry.find(f"{YT}channelId")),
                "publishedAt": published,
                "views": views,
                "likes": likes,
                "comments": 0,
                "discoverySource": self.name,
                "watchlistId": channel.get("id"),
                "watchlistRegion": channel.get("region"),
                "watchlistTopics": list(channel.get("topics") or []),
            })
        return items


def _parse_time(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
