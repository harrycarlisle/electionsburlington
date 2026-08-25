#!/usr/bin/env python3
"""Build a small Burlington GO utility feed from the official Metrolinx GO API.

Requires GO_API_KEY. The GO API is free but requires registration. Output is deliberately
small and explicit about scheduled vs predicted times so the homepage never presents
schedule data as realtime.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

BASE = "https://api.openmetrolinx.com/OpenDataAPI/api/V1"
OUT = pathlib.Path("data/go-status.json")
TZ = ZoneInfo("America/Toronto")
BURLINGTON_CODES = ("BU", "BURL")
UNION_CODES = ("UN", "UNI")


def get_json(path: str, key: str) -> dict:
    sep = "&" if "?" in path else "?"
    url = f"{BASE}/{path}{sep}{urllib.parse.urlencode({'key': key})}"
    req = urllib.request.Request(url, headers={"User-Agent": "BurlingtonNews/1.0 (+https://burlingtonnews.ca)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def discover_stop_codes(key: str) -> tuple[str, str]:
    payload = get_json("Stop/All", key)
    candidates = payload.get("Stops") or payload.get("Stop") or payload.get("AllStops") or []
    if isinstance(candidates, dict):
        candidates = candidates.get("Stop") or candidates.get("Stops") or []
    burlington = union = None
    for stop in candidates if isinstance(candidates, list) else []:
        name = str(stop.get("Name") or stop.get("StopName") or "").lower()
        code = str(stop.get("Code") or stop.get("StopCode") or "").strip()
        if not burlington and "burlington" in name and "go" in name:
            burlington = code
        if not union and "union" in name and "station" in name:
            union = code
    return burlington or BURLINGTON_CODES[0], union or UNION_CODES[0]


def choose_direction(now: dt.datetime) -> tuple[str, str, str, str]:
    # Commute-oriented default: toward Union before 2 p.m.; toward Burlington after.
    if now.hour < 14:
        return "Burlington", "Union", "burlington", "union"
    return "Union", "Burlington", "union", "burlington"


def normalize_journeys(payload: dict) -> list[dict]:
    journeys = payload.get("SchJourneys") or payload.get("Journeys") or []
    if isinstance(journeys, dict):
        journeys = journeys.get("Journey") or journeys.get("SchJourney") or []
    output = []
    for journey in journeys if isinstance(journeys, list) else []:
        services = journey.get("Services") or []
        if isinstance(services, dict):
            services = services.get("Service") or []
        if isinstance(services, dict):
            services = [services]
        service = services[0] if services else {}
        start = service.get("StartTime") or journey.get("Time")
        end = service.get("EndTime")
        duration = service.get("Duration")
        if not start:
            continue
        output.append({
            "departure": start,
            "arrival": end,
            "duration": duration,
            "line": service.get("Code") or "Lakeshore West",
            "type": service.get("Type") or "Train",
            "scheduled": True,
        })
    return output[:3]


def relevant_alerts(payload: dict) -> list[dict]:
    alerts = payload.get("Messages") or payload.get("ServiceAlerts") or payload.get("Alerts") or []
    if isinstance(alerts, dict):
        alerts = alerts.get("Message") or alerts.get("Alert") or []
    if isinstance(alerts, dict):
        alerts = [alerts]
    keep = []
    for alert in alerts if isinstance(alerts, list) else []:
        text = " ".join(str(alert.get(k) or "") for k in ("Subject", "Message", "Description", "Lines", "LineName"))
        lower = text.lower()
        if "lakeshore west" in lower or "burlington" in lower:
            keep.append({"headline": str(alert.get("Subject") or "GO service update"), "detail": str(alert.get("Message") or alert.get("Description") or "").strip()})
    return keep[:2]


def main() -> int:
    key = os.environ.get("GO_API_KEY", "").strip()
    if not key:
        print("GO_API_KEY is not configured; leaving existing GO status untouched.")
        return 0

    now = dt.datetime.now(TZ)
    burlington, union = discover_stop_codes(key)
    origin_label, destination_label, origin_kind, destination_kind = choose_direction(now)
    from_code = burlington if origin_kind == "burlington" else union
    to_code = union if destination_kind == "union" else burlington
    date = now.strftime("%Y%m%d")
    start = now.strftime("%H%M")
    journey = get_json(f"Schedule/Journey/{date}/{from_code}/{to_code}/{start}/3", key)
    try:
        alerts = relevant_alerts(get_json("ServiceUpdate/ServiceAlert/All", key))
    except Exception:
        alerts = []

    payload = {
        "generatedAt": now.isoformat(),
        "source": "Metrolinx GO API",
        "sourceUrl": "https://api.openmetrolinx.com/OpenDataAPI/Help",
        "dataKind": "scheduled",
        "route": "Lakeshore West",
        "origin": {"label": origin_label, "stopCode": from_code},
        "destination": {"label": destination_label, "stopCode": to_code},
        "journeys": normalize_journeys(journey),
        "alerts": alerts,
        "liveStatusUrl": "https://www.gotransit.com/en/see-schedules",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated GO status: {origin_label} -> {destination_label} ({from_code} -> {to_code})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
