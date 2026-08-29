#!/usr/bin/env python3
"""Build optional QEW traffic-flow intelligence from HERE Traffic API.

This is deliberately additive: if HERE_API_KEY is not configured, the existing
Ontario 511 traffic surface remains the source of truth and this script exits
without replacing useful data.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "traffic-flow.json"
HISTORY = DATA / "traffic-flow-history.json"
TZ = ZoneInfo("America/Toronto")
API = "https://data.traffic.hereapi.com/v7/flow"
USER_AGENT = "BurlingtonNews/3.0 (+https://burlingtonnews.ca/)"

# Keep the boxes tight to the QEW corridors we actually surface.
CORRIDORS = {
    "toronto": "43.300,-79.850,43.680,-79.350",
    "hamilton": "43.190,-79.960,43.390,-79.740",
}
QEW_RE = re.compile(r"\b(qew|queen elizabeth|gardiner)\b", re.I)
MAX_HISTORY = 4032  # about 14 days at 10-minute intervals for two directions


def request_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def flow_rows(payload):
    rows = []
    for result in payload.get("flowResults") or []:
        location = result.get("location") or {}
        current = result.get("currentFlow") or {}
        description = str(location.get("description") or "")
        road_names = location.get("roadNames") or []
        hay = " ".join([description, *[str(x) for x in road_names]])
        if hay and not QEW_RE.search(hay):
            continue
        speed = current.get("speed")
        free = current.get("freeFlow")
        jam = current.get("jamFactor")
        confidence = current.get("confidence")
        try:
            speed = float(speed) if speed is not None else None
            free = float(free) if free is not None else None
            jam = float(jam) if jam is not None else None
            confidence = float(confidence) if confidence is not None else None
        except (TypeError, ValueError):
            continue
        if jam is None and speed is None:
            continue
        rows.append({
            "description": description,
            "speedKph": speed,
            "freeFlowKph": free,
            "jamFactor": jam,
            "confidence": confidence,
        })
    return rows


def median(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    middle = len(values) // 2
    if len(values) % 2:
        return values[middle]
    return (values[middle - 1] + values[middle]) / 2


def label(jam):
    if jam is None:
        return "Unknown"
    if jam < 2.0:
        return "Clear"
    if jam < 4.0:
        return "Moderate"
    if jam < 7.0:
        return "Slow"
    return "Heavy"


def summarize(rows):
    jam = median([row["jamFactor"] for row in rows])
    speed = median([row["speedKph"] for row in rows])
    free = median([row["freeFlowKph"] for row in rows])
    slowdown_pct = None
    if speed and free and free > 0:
        slowdown_pct = max(0, round((1 - speed / free) * 100))
    return {
        "status": label(jam),
        "jamFactor": round(jam, 1) if jam is not None else None,
        "speedKph": round(speed) if speed is not None else None,
        "freeFlowKph": round(free) if free is not None else None,
        "slowdownPct": slowdown_pct,
        "segments": len(rows),
    }


def load_history():
    if not HISTORY.exists():
        return {"samples": []}
    try:
        return json.loads(HISTORY.read_text(encoding="utf-8"))
    except Exception:
        return {"samples": []}


def trend(direction, current_jam, history):
    if current_jam is None:
        return ""
    recent = [
        s for s in history.get("samples", [])[-72:]
        if s.get("direction") == direction and isinstance(s.get("jamFactor"), (int, float))
    ]
    if len(recent) < 2:
        return ""
    previous = recent[-1]["jamFactor"]
    delta = current_jam - previous
    if delta >= 0.8:
        return "Getting worse"
    if delta <= -0.8:
        return "Improving"
    return "Steady"


def main() -> int:
    api_key = os.environ.get("HERE_API_KEY", "").strip()
    if not api_key:
        print("HERE_API_KEY not configured; preserving Ontario 511 fallback.")
        return 0

    now = dt.datetime.now(TZ)
    history = load_history()
    routes = {}
    new_samples = []

    for direction, bbox in CORRIDORS.items():
        query = urllib.parse.urlencode({
            "in": f"bbox:{bbox}",
            "locationReferencing": "shape",
            "apiKey": api_key,
        })
        try:
            payload = request_json(f"{API}?{query}")
            rows = flow_rows(payload)
            summary = summarize(rows)
        except Exception as exc:
            print(f"HERE {direction} unavailable: {type(exc).__name__}: {exc}")
            summary = {"status": "Unknown", "jamFactor": None, "speedKph": None, "freeFlowKph": None, "slowdownPct": None, "segments": 0}

        summary["trend"] = trend(direction, summary.get("jamFactor"), history)
        routes[direction] = summary
        if summary.get("jamFactor") is not None:
            new_samples.append({
                "at": now.isoformat(),
                "direction": direction,
                "jamFactor": summary["jamFactor"],
                "speedKph": summary.get("speedKph"),
                "freeFlowKph": summary.get("freeFlowKph"),
                "slowdownPct": summary.get("slowdownPct"),
            })

    payload = {
        "generatedAt": now.isoformat(),
        "source": "HERE Real-Time Traffic",
        "enabled": any(route.get("jamFactor") is not None for route in routes.values()),
        "routes": routes,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    samples = (history.get("samples") or []) + new_samples
    HISTORY.write_text(json.dumps({"samples": samples[-MAX_HISTORY:]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"HERE traffic flow: {sum(route.get('segments', 0) for route in routes.values())} QEW segments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
