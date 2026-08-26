"""Environment Canada alerts. Official API only; skip if unreachable."""

from __future__ import annotations

from typing import Any

from .fetch import fetch_json
from .model import quick_update

ALERTS_URL = "https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=-79.95,43.25,-79.65,43.48&limit=25"


def collect(now_iso: str, *, live: bool = False, cached: list[dict] | None = None, **_: Any) -> list[dict[str, Any]]:
    features = list(cached or [])
    if live:
        try:
            payload = fetch_json(ALERTS_URL, timeout=8)
            features.extend(payload.get("features") or [])
        except Exception:
            pass
    items = []
    for feature in features:
        props = feature.get("properties") if isinstance(feature, dict) and "properties" in feature else feature
        if not isinstance(props, dict):
            continue
        title = props.get("alert_name_en") or props.get("headline") or ""
        if not title:
            continue
        colour = str(props.get("risk_colour_en") or "").lower()
        kind = str(props.get("alert_type") or "").lower()
        high = colour in {"red", "orange"} or kind == "warning" or "tornado" in title.lower()
        if not high:
            continue
        items.append(quick_update(
            headline=title,
            summary=props.get("alert_text_en") or "",
            category="WEATHER",
            eventType="weather",
            sourceType="official",
            sourceName="Environment Canada",
            sourceUrl="https://weather.gc.ca/warnings/report_e.html?onrm70=undefined",
            publishedAt=props.get("issuance_datetime") or now_iso,
            expiresAt=props.get("expiration_datetime") or "",
            discoveredAt=now_iso,
            verificationStatus="verified",
            confidenceScore=5.0,
            severity="critical" if colour == "red" or "tornado" in title.lower() else "high",
            relatedUtility="driving",
            storyUrl="/live/",
            city="Burlington",
        ))
    return items
