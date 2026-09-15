from __future__ import annotations

import re
import unicodedata

from .concept import ENTITY_ALIASES
from .match import alias_hit, hay_for_entity

STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "this",
    "that", "from", "how", "why", "what", "is", "are", "was", "my", "i", "you",
    "we", "it", "at", "new", "video", "watch",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9\s]+", " ", text.lower())


def entity_key(title: str, description: str = "") -> str:
    hay = hay_for_entity({"title": title, "description": description})
    for key, aliases in ENTITY_ALIASES.items():
        if any(alias_hit(hay, alias) for alias in aliases):
            return key
    hay = normalize(f"{title} {description[:240]}")
    tokens = [token for token in hay.split() if token not in STOP and len(token) > 2]
    return " ".join(tokens[:4]) or normalize(title)[:40]


def cluster_videos(videos: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for video in videos:
        key = entity_key(video.get("title") or "", video.get("description") or "")
        groups.setdefault(key, []).append(video)
    clustered = []
    for key, members in groups.items():
        members = sorted(members, key=lambda item: item.get("overallScore") or 0, reverse=True)
        primary = dict(members[0])
        primary["clusterId"] = key
        primary["supportingVideos"] = [
            {
                "videoId": item.get("videoId"),
                "title": item.get("title"),
                "channel": item.get("channel"),
                "videoUrl": item.get("videoUrl"),
                "views": item.get("views"),
            }
            for item in members[1:6]
        ]
        primary["clusterSize"] = len(members)
        clustered.append(primary)
    clustered.sort(key=lambda item: item.get("overallScore") or 0, reverse=True)
    return clustered
