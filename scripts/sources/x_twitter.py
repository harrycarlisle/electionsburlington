"""Optional official X discovery for urgent local public-safety posts.

Uses X API v2 only when X_BEARER_TOKEN is configured. No scraping and no
unofficial proxy. The breaking-news pipeline continues normally without it.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

from .model import make_signal

ACCOUNTS = (
    ("HaltonPolice", "Halton Regional Police", "halton", 1.0),
    ("HamiltonPolice", "Hamilton Police", "hamilton", 0.72),
)
URGENT = (
    "shooting", "shots fired", "firearm", "gun", "armed", "suspect outstanding",
    "at large", "avoid the area", "shelter in place", "lockdown", "evacuate",
    "active investigation", "missing child", "amber alert", "serious collision",
    "fatal collision", "road closed", "emergency",
)


def _get_json(url: str, token: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "User-Agent": "BurlingtonNews/1.0"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _urgent(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in URGENT)


def collect(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    token = os.getenv("X_BEARER_TOKEN", "").strip()
    if not token:
        return []

    output: list[dict[str, Any]] = []
    for username, source_name, municipality, proximity in ACCOUNTS:
        try:
            lookup = _get_json(
                "https://api.x.com/2/users/by/username/" + urllib.parse.quote(username), token
            )
            user_id = str((lookup.get("data") or {}).get("id") or "")
            if not user_id:
                continue
            timeline = _get_json(
                f"https://api.x.com/2/users/{user_id}/tweets?max_results=10&exclude=retweets,replies&tweet.fields=created_at",
                token,
            )
            for post in timeline.get("data") or []:
                text = str(post.get("text") or "").strip()
                if not text or not _urgent(text):
                    continue
                created = str(post.get("created_at") or datetime.now(timezone.utc).isoformat())
                output.append(make_signal(
                    source=f"x:{username.lower()}",
                    source_name=source_name,
                    source_url=f"https://x.com/{username}/status/{post.get('id')}",
                    headline=text,
                    published_at=created,
                    municipality=municipality,
                    kind="public-safety",
                    official=True,
                    proximity=proximity,
                    metadata={"platform": "x", "officialAccount": username, "urgentDiscovery": True},
                ))
        except Exception:
            continue
    return output
