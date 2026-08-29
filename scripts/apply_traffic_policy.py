#!/usr/bin/env python3
"""Keep routine ramp construction from dominating Burlington News traffic surfaces.

Ontario 511 is excellent for incidents, but recurring construction ramp closures can
sit in the feed for days. They are useful context, not a good primary answer to
"how is the QEW right now?". This postprocessor keeps those advisories available on
route pages while making mainline conditions, collisions and live flow the primary
status shown on the homepage and route summary.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SURFACE = DATA / "traffic-surface.json"
FLOW = DATA / "traffic-flow.json"
TZ = ZoneInfo("America/Toronto")


def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def routine_ramp(item: dict) -> bool:
    text = " ".join(str(item.get(key) or "") for key in ("title", "rawHeadline", "facility", "type")).lower()
    ramp = item.get("facility") in {"on-ramp", "off-ramp"} or "on-ramp" in text or "off-ramp" in text
    planned = any(word in text for word in ("construction", "maintenance", "engineering investigation", "nightly", "continuous"))
    return bool(ramp and item.get("type") == "closure" and planned)


def primary_disruption(item: dict) -> bool:
    if item.get("type") == "collision":
        return True
    if item.get("type") != "closure":
        return False
    return not routine_ramp(item)


def camera_condition(route: dict) -> str:
    looks = [str(cam.get("looks") or "").strip().lower() for cam in (route.get("cameras") or [])]
    looks = [look for look in looks if look]
    if not looks:
        return ""
    severity = {"clear": 0, "light": 0, "moderate": 1, "slow": 2, "heavy": 3}
    ranked = sorted((severity.get(look, 1), look) for look in looks)
    # Avoid one noisy frame making the whole corridor "heavy": use the upper-middle sample.
    return ranked[min(len(ranked) - 1, max(0, int(len(ranked) * 0.7)))][1]


def flow_status(flow: dict, route_id: str) -> dict | None:
    if not flow.get("enabled"):
        return None
    row = (flow.get("routes") or {}).get(route_id) or {}
    status = str(row.get("status") or "").strip().lower()
    if not status or status == "unknown":
        return None
    mapped = {
        "clear": ("clear", "Moving well"),
        "moderate": ("moderate", "Some slowing"),
        "slow": ("slow", "Slow traffic"),
        "heavy": ("heavy", "Heavy traffic"),
    }
    level, headline = mapped.get(status, (status, status.title()))
    parts = []
    slowdown = row.get("slowdownPct")
    if isinstance(slowdown, (int, float)) and slowdown >= 5:
        parts.append(f"{round(slowdown)}% slower than free flow")
    trend = str(row.get("trend") or "").strip()
    if trend:
        parts.append(trend)
    return {
        "level": level,
        "headline": headline,
        "detail": " · ".join(parts),
        "looks": level,
        "source": "HERE Real-Time Traffic",
    }


def route_status(route_id: str, route: dict, flow: dict) -> dict:
    incidents = route.get("incidents") or []
    mainline = next((item for item in incidents if primary_disruption(item)), None)
    advisories = [item for item in incidents if routine_ramp(item)]
    route["advisories"] = advisories[:3]

    if mainline:
        return {
            "level": "delay",
            "headline": "Delay likely",
            "detail": mainline.get("title") or "Mainline incident reported",
            "looks": "",
            "source": mainline.get("source") or "Ontario 511",
        }

    live_flow = flow_status(flow, route_id)
    if live_flow:
        if advisories:
            live_flow["advisory"] = advisories[0].get("title") or "Local ramp closure reported"
        return live_flow

    looks = camera_condition(route)
    if looks:
        headlines = {
            "clear": "Moving well",
            "light": "Moving well",
            "moderate": "Some slowing",
            "slow": "Slow traffic",
            "heavy": "Heavy traffic",
        }
        result = {
            "level": looks,
            "headline": headlines.get(looks, "Live route check"),
            "detail": "Based on the latest available route cameras",
            "looks": looks,
            "source": "Ontario 511 cameras",
        }
        if advisories:
            result["advisory"] = advisories[0].get("title") or "Local ramp closure reported"
        return result

    camera_count = len(route.get("cameras") or [])
    result = {
        "level": "unknown",
        "headline": "Live route check",
        "detail": f"{camera_count} cameras along this route" if camera_count else "Live incidents and cameras",
        "looks": "",
        "source": "Ontario 511",
    }
    if advisories:
        result["advisory"] = advisories[0].get("title") or "Local ramp closure reported"
    return result


def main() -> int:
    surface = load(SURFACE, {})
    if not surface:
        print("No traffic surface to postprocess")
        return 0
    flow = load(FLOW, {})

    # Routine construction ramp closures stay inside each route as advisories,
    # but are removed from the global alert pool that feeds the homepage card.
    surface["incidents"] = [item for item in (surface.get("incidents") or []) if not routine_ramp(item)]

    routes = surface.get("routes") or {}
    for route_id, route in routes.items():
        route["status"] = route_status(route_id, route, flow)

    now = dt.datetime.now(TZ)
    commute_id = "hamilton" if now.hour >= 15 else "toronto"
    route = routes.get(commute_id) or routes.get("toronto") or {}
    destination = route.get("destination") or route.get("label") or commute_id.title()
    status = route.get("status") or {}
    surface["homepageTraffic"] = {
        "label": "Traffic",
        "title": f"QEW → {destination}",
        "context": status.get("headline") or "Live route check",
        "impact": status.get("detail") or "",
        "freshness": "",
        "url": f"/traffic/?destination={commute_id}",
        "alert": status.get("level") in {"delay", "heavy", "slow"},
        "advisory": status.get("advisory") or "",
    }
    surface["presentationPolicy"] = {
        "primary": "mainline conditions and live flow",
        "secondary": "routine construction ramp closures",
        "updatedAt": now.isoformat(),
    }

    SURFACE.write_text(json.dumps(surface, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Traffic policy applied: {len(surface.get('incidents') or [])} primary incidents")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
