"""Map official alert text to a cause label. Never invent from community chatter."""

from __future__ import annotations

import re
from typing import Any

CAUSES = (
    ("Police investigation", re.compile(r"\b(police investigation|investigating|opp|halton police|tps)\b", re.I)),
    ("Emergency response", re.compile(r"\b(emergency response|ems|ambulance|fire service|hazmat)\b", re.I)),
    ("Pedestrian incident", re.compile(r"\b(pedestrian|trespass(?:er|ing)?|person on (?:the )?track)\b", re.I)),
    ("Track issue", re.compile(r"\b(track issue|broken rail|track problem|rail defect)\b", re.I)),
    ("Signal issue", re.compile(r"\b(signal issue|signal problem|signalling)\b", re.I)),
    ("Mechanical issue", re.compile(r"\b(mechanical|train fault|disabled train|equipment)\b", re.I)),
    ("Weather", re.compile(r"\b(weather|storm|snow|ice|flood|high wind|lightning)\b", re.I)),
    ("Collision", re.compile(r"\b(collision|crash|motor vehicle)\b", re.I)),
    ("Construction", re.compile(r"\b(construction|road work|paving|nightly work)\b", re.I)),
    ("Disabled vehicle", re.compile(r"\b(disabled vehicle|stalled|broken[- ]down)\b", re.I)),
    ("Debris", re.compile(r"\b(debris|object on (?:the )?(?:road|track))\b", re.I)),
)


def official_cause(text: str, *, official: bool) -> str:
    """Return a coarse cause only when the text is from an official or established source."""
    if not official or not text:
        return ""
    for label, pattern in CAUSES:
        if pattern.search(text):
            return label
    return ""


def enrich_cause(item: dict[str, Any]) -> dict[str, Any]:
    source_type = str(item.get("sourceType") or "").lower()
    official = source_type in {"official", "primary", "official_social", "reporting", "newsroom"}
    status = str(item.get("verificationStatus") or "").lower()
    if status in {"community_lead", "unverified", "unverified_community_report"}:
        official = False
    text = " ".join(str(item.get(key) or "") for key in ("headline", "summary", "rawText", "cause"))
    if official and not item.get("cause"):
        item["cause"] = official_cause(text, official=True) or ""
    if not official:
        # Keep any already verified cause; never upgrade speculation.
        if str(item.get("cause") or "").lower() in {"person on tracks", "someone on the tracks"}:
            item["cause"] = ""
    return item
