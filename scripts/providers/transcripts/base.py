from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TranscriptResult:
    text: str = ""
    excerpts: list[str] = field(default_factory=list)
    source: str = "none"
    confidence: float = 0.0
    status: str = "TRANSCRIPT UNAVAILABLE"
    notes: str = ""
