"""YouTube Data API v3. Used only when YOUTUBE_API_KEY is present. Quota-aware."""

from __future__ import annotations

import os
import urllib.parse
from typing import Any

from sources.fetch import fetch_json


class YouTubeDataApiProvider:
    name = "youtube_data_api"
    kind = "VideoDiscoveryProvider"

    def __init__(self, api_key: str | None = None, fetch=fetch_json):
        self.api_key = api_key if api_key is not None else os.environ.get("YOUTUBE_API_KEY", "").strip()
        self.fetch = fetch

    def available(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, max_results: int = 5, published_after: str | None = None) -> list[dict[str, Any]]:
        if not self.available():
            return []
        params = {
            "part": "snippet",
            "type": "video",
            "maxResults": max(1, min(int(max_results), 10)),
            "q": query,
            "order": "date",
            "relevanceLanguage": "en",
            "regionCode": "CA",
            "key": self.api_key,
        }
        if published_after:
            params["publishedAfter"] = published_after
        url = "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(params)
        try:
            data = self.fetch(url, timeout=18)
        except Exception:
            return []
        videos = []
        for item in data.get("items") or []:
            video_id = ((item.get("id") or {}).get("videoId")) or ""
            snippet = item.get("snippet") or {}
            if not video_id:
                continue
            videos.append({
                "videoId": video_id,
                "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
                "title": snippet.get("title") or "",
                "description": (snippet.get("description") or "")[:4000],
                "channel": snippet.get("channelTitle") or "",
                "channelId": snippet.get("channelId") or "",
                "publishedAt": snippet.get("publishedAt") or "",
                "views": 0,
                "likes": 0,
                "comments": 0,
                "discoverySource": self.name,
                "searchQuery": query,
            })
        return self._hydrate_stats(videos)

    def _hydrate_stats(self, videos: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ids = [item["videoId"] for item in videos if item.get("videoId")]
        if not ids or not self.available():
            return videos
        params = {
            "part": "statistics,contentDetails,snippet",
            "id": ",".join(ids[:15]),
            "key": self.api_key,
        }
        url = "https://www.googleapis.com/youtube/v3/videos?" + urllib.parse.urlencode(params)
        try:
            data = self.fetch(url, timeout=18)
        except Exception:
            return videos
        by_id = {item.get("id"): item for item in data.get("items") or []}
        for video in videos:
            extra = by_id.get(video["videoId"]) or {}
            stats = extra.get("statistics") or {}
            details = extra.get("contentDetails") or {}
            video["views"] = int(stats.get("viewCount") or video.get("views") or 0)
            video["likes"] = int(stats.get("likeCount") or video.get("likes") or 0)
            video["comments"] = int(stats.get("commentCount") or 0)
            video["duration"] = details.get("duration") or ""
            video["hasCaptions"] = (extra.get("contentDetails") or {}).get("caption") == "true"
        return videos

    def list_captions(self, video_id: str) -> list[dict[str, Any]]:
        if not self.available() or not video_id:
            return []
        params = {"part": "snippet", "videoId": video_id, "key": self.api_key}
        url = "https://www.googleapis.com/youtube/v3/captions?" + urllib.parse.urlencode(params)
        try:
            data = self.fetch(url, timeout=15)
        except Exception:
            return []
        return data.get("items") or []
