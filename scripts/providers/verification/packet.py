"""Verification adapter. Video claims stay creator_claim until a human or a later task checks primary sources."""

from __future__ import annotations

from typing import Any


class ResearchPacketProvider:
    name = "research_packet"
    kind = "VerificationProvider"

    def verify(self, claims: list[dict[str, Any]]) -> list[dict[str, Any]]:
        verified = []
        for claim in claims:
            item = dict(claim)
            item.setdefault("verificationStatus", "creator_claim")
            item.setdefault("verificationSource", "")
            item.setdefault("confidence", "low")
            verified.append(item)
        return verified
