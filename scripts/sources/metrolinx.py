"""Official Metrolinx / GO alerts already stored in go-status.json."""

from __future__ import annotations

from typing import Any

from .cause import official_cause
from .model import quick_update


def collect(now_iso: str, go_status: dict | None = None, **_: Any) -> list[dict[str, Any]]:
    alerts = list((go_status or {}).get("alerts") or [])
    items = []
    for alert in alerts:
        headline = alert.get("headline") or alert.get("title") or "GO service update"
        detail = alert.get("detail") or alert.get("description") or ""
        text = f"{headline} {detail}"
        severe = bool(__import__("re").search(r"cancel|suspend|stopped|stoppage|bus replac", text, __import__("re").I))
        items.append(quick_update(
            headline=headline,
            summary=detail,
            category="TRANSIT",
            eventType="go",
            sourceType="official",
            sourceName="Metrolinx / GO Transit",
            sourceUrl=(go_status or {}).get("liveStatusUrl") or "https://www.gotransit.com/en/see-schedules",
            publishedAt=(go_status or {}).get("generatedAt") or now_iso,
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            relatedUtility="go",
            cause=official_cause(text, official=True),
            severity="critical" if severe else "moderate",
            status="ongoing" if severe else "active",
            storyUrl="/live/",
        ))
    return items
