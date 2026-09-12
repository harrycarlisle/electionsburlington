"""Priority 1: official YouTube captions.list.

captions.download requires OAuth, so this adapter only records whether a
public caption track exists. It never uses unofficial timedtext endpoints.
"""

from __future__ import annotations

from .base import TranscriptResult


class OfficialCaptionsProvider:
    name = "youtube_captions_api"
    kind = "TranscriptProvider"
    confidence = 0.85

    def __init__(self, api=None):
        self.api = api

    def can_handle(self, video: dict) -> bool:
        return bool(self.api and getattr(self.api, "available", lambda: False)() and video.get("videoId"))

    def fetch_transcript(self, video: dict) -> TranscriptResult:
        if not self.can_handle(video):
            return TranscriptResult(status="TRANSCRIPT UNAVAILABLE", source=self.name, notes="YouTube API key or video id missing.")
        try:
            tracks = self.api.list_captions(video["videoId"])
        except Exception:
            return TranscriptResult(status="TRANSCRIPT UNAVAILABLE", source=self.name, notes="captions.list failed.")
        if not tracks:
            return TranscriptResult(
                status="TRANSCRIPT UNAVAILABLE",
                source=self.name,
                notes="No caption tracks listed. captions.download was not attempted (OAuth required).",
            )
        languages = [((item.get("snippet") or {}).get("language") or "") for item in tracks]
        return TranscriptResult(
            text="",
            excerpts=[],
            source=self.name,
            confidence=0.5,
            status="caption_track_listed",
            notes="Official caption track exists: " + ", ".join(lang for lang in languages if lang) + ". Download skipped without OAuth.",
        )
