"""Priority 2: creator-provided description, chapters, and public metadata."""

from __future__ import annotations

import re

from .base import TranscriptResult


class CreatorTextProvider:
    name = "creator_text"
    kind = "TranscriptProvider"
    confidence = 0.45

    def can_handle(self, video: dict) -> bool:
        return bool((video.get("description") or "").strip() or (video.get("title") or "").strip())

    def fetch_transcript(self, video: dict) -> TranscriptResult:
        description = (video.get("description") or "").strip()
        chapters = _chapters(description)
        excerpts = []
        if chapters:
            excerpts.extend(chapters[:8])
        elif description:
            excerpts.extend(_sentences(description)[:6])
        status = "description_only"
        if not description:
            status = "TRANSCRIPT UNAVAILABLE"
        return TranscriptResult(
            text=description[:2500],
            excerpts=excerpts,
            source=self.name,
            confidence=self.confidence if description else 0.15,
            status=status,
            notes="Used creator title/description only. Not a caption track.",
        )


def _chapters(description: str) -> list[str]:
    found = []
    for line in description.splitlines():
        if re.match(r"^\s*\d{1,2}:\d{2}", line):
            found.append(re.sub(r"\s+", " ", line).strip())
    return found


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())
    return [part.strip() for part in parts if 40 <= len(part) <= 240]
