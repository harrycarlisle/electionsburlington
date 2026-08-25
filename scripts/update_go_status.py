#!/usr/bin/env python3
"""Build Burlington GO utility data from the official Metrolinx GO API.

Requires GO_API_KEY. Schedule/Journey supplies Burlington↔Union itineraries and
Stop/NextService supplies current predictions/status. Output distinguishes scheduled
and computed times so Burlington News never labels schedule-only data as live.
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
BURLINGTON = "BU"
UNION = "UN"
LINE = "LW"


def get_json(path: str, key: str) -> dict:
    sep = "&" if "?" in path else "?"
    url = f"{BASE}/{path}{sep}{urllib.parse.urlencode({'key': key})}"
    req = urllib.request.Request(url, headers={"User-Agent": "BurlingtonNews/1.0 (+https://burlingtonnews.ca)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def choose_direction(now: dt.datetime) -> tuple[str, str, str, str]:
    # Commute-oriented default. The data model supports either direction without UI changes.
    if now.hour < 14:
        return "Burlington", "Union", BURLINGTON, UNION
    return "Union", "Burlington", UNION, BURLINGTON


def first_trip_number(service: dict) -> str:
    trips = service.get("Trips") or {}
    if isinstance(trips, dict):
        trips = trips.get("Trip") or []
    if isinstance(trips, dict):
        trips = [trips]
    return str((trips[0] if trips else {}).get("Number") or "")


def normalize_journeys(payload: dict) -> list[dict]:
    journeys = payload.get("SchJourneys") or []
    if isinstance(journeys, dict):
        journeys = journeys.get("Journey") or []
    if isinstance(journeys, dict):
        journeys = [journeys]
    output = []
    for journey in journeys if isinstance(journeys, list) else []:
        services = journey.get("Services") or []
        if isinstance(services, dict) and "Service" in services:
            services = services.get("Service") or []
        if isinstance(services, dict):
            services = [services]
        # Prefer the rail leg if a journey ever includes a transfer.
        service = next((s for s in services if str(s.get("Code") or "").upper() == LINE), services[0] if services else {})
        start = service.get("StartTime") or journey.get("Time")
        if not start:
            continue
        output.append({
            "departure": start,
            "arrival": service.get("EndTime"),
            "duration": service.get("Duration"),
            "line": service.get("Code") or LINE,
            "type": service.get("Type") or "Train",
            "tripNumber": first_trip_number(service),
            "scheduled": True,
        })
    return output[:3]


def next_service_rows(payload: dict) -> list[dict]:
    rows = (payload.get("NextService") or {}).get("Lines") or []
    if isinstance(rows, dict):
        rows = [rows]
    return [row for row in rows if str(row.get("LineCode") or "").upper() == LINE]


def attach_predictions(journeys: list[dict], next_service: dict) -> tuple[list[dict], bool]:
    rows = next_service_rows(next_service)
    by_trip = {str(row.get("TripNumber") or ""): row for row in rows if row.get("TripNumber")}
    any_prediction = False
    for journey in journeys:
        row = by_trip.get(str(journey.get("tripNumber") or ""))
        if not row:
            continue
        computed = row.get("ComputedDepartureTime")
        scheduled = row.get("ScheduledDepartureTime")
        if scheduled:
            journey["departure"] = scheduled
        if computed:
            journey["computedDeparture"] = computed
            any_prediction = True
        journey["departureStatus"] = row.get("DepartureStatus") or row.get("Status") or ""
        journey["platform"] = row.get("ActualPlatform") or row.get("ScheduledPlatform") or ""
        journey["predictionUpdatedAt"] = row.get("UpdateTime") or ""
    return journeys, any_prediction


def relevant_alerts(payload: dict) -> list[dict]:
    alerts = payload.get("Messages") or payload.get("ServiceAlerts") or payload.get("Alerts") or []
    if isinstance(alerts, dict):
        alerts = alerts.get("Message") or alerts.get("Alert") or alerts.get("Messages") or []
    if isinstance(alerts, dict):
        alerts = [alerts]
    keep = []
    for alert in alerts if isinstance(alerts, list) else []:
        text = " ".join(str(alert.get(k) or "") for k in ("Subject", "Message", "Description", "Lines", "LineName", "Route"))
        lower = text.lower()
        if "lakeshore west" in lower or "burlington" in lower or " lw " in f" {lower} ":
            keep.append({
                "headline": str(alert.get("Subject") or alert.get("Title") or "GO service update").strip(),
                "detail": str(alert.get("Message") or alert.get("Description") or "").strip(),
            })
    return keep[:2]


def main() -> int:
    key = os.environ.get("GO_API_KEY", "").strip()
    if not key:
        print("GO_API_KEY is not configured; leaving existing GO status untouched.")
        return 0

    now = dt.datetime.now(TZ)
    origin_label, destination_label, from_code, to_code = choose_direction(now)
    date = now.strftime("%Y%m%d")
    start = now.strftime("%H%M")

    schedule = get_json(f"Schedule/Journey/{date}/{from_code}/{to_code}/{start}/3", key)
    journeys = normalize_journeys(schedule)
    predicted = False
    try:
        journeys, predicted = attach_predictions(journeys, get_json(f"Stop/NextService/{from_code}", key))
    except Exception as exc:
        print(f"GO predictions unavailable; using schedule only: {type(exc).__name__}: {exc}")

    try:
        alerts = relevant_alerts(get_json("ServiceUpdate/ServiceAlert/All", key))
    except Exception as exc:
        print(f"GO alerts unavailable: {type(exc).__name__}: {exc}")
        alerts = []

    payload = {
        "generatedAt": now.isoformat(),
        "source": "Metrolinx GO API",
        "sourceUrl": "https://api.openmetrolinx.com/OpenDataAPI/Help",
        "dataKind": "realtime" if predicted else "scheduled",
        "route": "Lakeshore West",
        "lineCode": LINE,
        "origin": {"label": origin_label, "stopCode": from_code},
        "destination": {"label": destination_label, "stopCode": to_code},
        "journeys": journeys,
        "alerts": alerts,
        "liveStatusUrl": "https://www.gotransit.com/en/see-schedules",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated GO status: {origin_label} -> {destination_label} ({from_code} -> {to_code}); {payload['dataKind']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
