"""Live-utility default and critical-override rules.

Threshold
---------
Driving is the default on every fresh page load.

A utility may override Driving only at **critical** severity:

Critical (may become first card):
- GO / Lakeshore West service suspended, cancelled, stopped, or bus-replaced
- Skyway fully closed, or all lanes closed on the bridge
- QEW / 403 **mainline** complete closure affecting Burlington travel
- Tornado warning, evacuation, or a major Burlington emergency
- Widespread power emergency with immediate local risk

Not critical (Driving stays first):
- A 5–15 minute GO delay
- Moderate or heavy traffic without a mainline closure
- An on-ramp / off-ramp closure
- Nightly or routine construction
- A single-lane restriction
"""

from __future__ import annotations

import re
from typing import Any

CRITICAL_GO = re.compile(
    r"\b(cancel+ed|suspend(?:ed|s)?|stopped|stoppage|no service|bus replac)\b",
    re.I,
)
CRITICAL_ROAD = re.compile(
    r"\b(all lanes closed|completely closed|fully closed|closed in both directions|road closed)\b",
    re.I,
)
RAMP_ONLY = re.compile(r"\b(on-ramp|off-ramp|ramp)\b", re.I)
CONSTRUCTION = re.compile(r"\b(construction|road work|nightly)\b", re.I)


def is_critical_go(model: dict[str, Any] | None) -> bool:
    if not model:
        return False
    text = f"{model.get('headline') or ''} {model.get('detail') or ''} {model.get('description') or ''}"
    if model.get("critical"):
        return True
    return bool(CRITICAL_GO.search(text))


def is_critical_road(item: dict[str, Any] | None, *, skyway: bool = False) -> bool:
    if not item:
        return False
    if item.get("critical"):
        return True
    text = " ".join(str(item.get(key) or "") for key in ("title", "rawHeadline", "headline", "detail", "type"))
    facility = str(item.get("facility") or "").lower()
    kind = str(item.get("type") or "").lower()
    if facility in {"on-ramp", "off-ramp"} or RAMP_ONLY.search(text):
        return False
    if CONSTRUCTION.search(text) and not CRITICAL_ROAD.search(text):
        return False
    if skyway and kind == "closure":
        return True
    if kind == "closure" and CRITICAL_ROAD.search(text):
        return True
    if kind == "closure" and item.get("facility") == "mainline" and "all lanes" in text.lower():
        return True
    return False


def is_critical_weather(item: dict[str, Any] | None) -> bool:
    if not item:
        return False
    text = " ".join(str(item.get(key) or "") for key in ("headline", "alert_name_en", "title", "rawText")).lower()
    colour = str(item.get("risk_colour_en") or item.get("severity") or "").lower()
    return any(term in text for term in ("tornado", "evacuat", "tsunami")) or colour == "red"


def is_critical_utility(kind: str, model: dict[str, Any] | None) -> bool:
    if kind == "go":
        return is_critical_go(model)
    if kind == "skyway":
        return is_critical_road(model, skyway=True) or bool(model and model.get("critical"))
    if kind == "driving":
        return is_critical_road(model, skyway=False) or bool(model and model.get("critical"))
    if kind == "weather":
        return is_critical_weather(model)
    return False


def choose_default_mode(models: dict[str, Any]) -> str:
    """Driving unless a verified critical utility outranks it."""
    order = ("go", "skyway", "driving", "weather")
    for kind in order:
        if is_critical_utility(kind, models.get(kind)):
            return "go" if kind == "weather" and not models.get("go") else (
                "driving" if kind == "weather" else kind
            )
    return "driving"
