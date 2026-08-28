#!/usr/bin/env python3
"""Build Burlington GO utility data from official Metrolinx sources.

With GO_API_KEY, use the documented GO API for schedule + predictions.
Without a key, fall back to Metrolinx's public GO GTFS schedule feed and keep the
UI explicitly labelled Scheduled. The payload deliberately keeps enough of the
service day that an older successful refresh is still useful later that day.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import os
import pathlib
import urllib.parse
import urllib.request
import zipfile
from zoneinfo import ZoneInfo

BASE = "https://api.openmetrolinx.com/OpenDataAPI/api/V1"
GTFS_URL = "https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip"
OUT = pathlib.Path("data/go-status.json")
TZ = ZoneInfo("America/Toronto")
BURLINGTON = "BU"
UNION = "UN"
WEST_HARBOUR = "WR"
LINE = "LW"
TARGETS = (("Union", UNION), ("West Harbour", WEST_HARBOUR))
API_JOURNEY_LIMIT = 32
GTFS_JOURNEY_LIMIT = 64


def request(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "BurlingtonNews/1.1 (+https://burlingtonnews.ca)"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()


def get_json(path: str, key: str) -> dict:
    sep = "&" if "?" in path else "?"
    url = f"{BASE}/{path}{sep}{urllib.parse.urlencode({'key': key})}"
    return json.loads(request(url))


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
    return output[:API_JOURNEY_LIMIT]


def next_service_rows(payload: dict) -> list[dict]:
    rows = (payload.get("NextService") or {}).get("Lines") or []
    if isinstance(rows, dict):
        rows = [rows]
    return [row for row in rows if str(row.get("LineCode") or "").upper() == LINE]


def attach_predictions(journeys: list[dict], rows: list[dict]) -> bool:
    by_trip = {str(row.get("TripNumber") or ""): row for row in rows if row.get("TripNumber")}
    predicted = False
    for journey in journeys:
        row = by_trip.get(str(journey.get("tripNumber") or ""))
        if not row:
            continue
        if row.get("ScheduledDepartureTime"):
            journey["departure"] = row["ScheduledDepartureTime"]
        if row.get("ComputedDepartureTime"):
            journey["computedDeparture"] = row["ComputedDepartureTime"]
            predicted = True
        journey["departureStatus"] = row.get("DepartureStatus") or row.get("Status") or ""
        journey["platform"] = row.get("ActualPlatform") or row.get("ScheduledPlatform") or ""
        journey["predictionUpdatedAt"] = row.get("UpdateTime") or ""
    return predicted


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


def build_api(key: str, now: dt.datetime) -> dict:
    date = now.strftime("%Y%m%d")
    start = now.strftime("%H%M")
    tomorrow = (now + dt.timedelta(days=1)).strftime("%Y%m%d")
    try:
        rows = next_service_rows(get_json(f"Stop/NextService/{BURLINGTON}", key))
    except Exception as exc:
        print(f"GO predictions unavailable: {type(exc).__name__}: {exc}")
        rows = []
    predicted = False
    routes = []
    for label, code in TARGETS:
        journeys = normalize_journeys(get_json(f"Schedule/Journey/{date}/{BURLINGTON}/{code}/{start}/{API_JOURNEY_LIMIT}", key))
        if len(journeys) < 2:
            extra = normalize_journeys(get_json(f"Schedule/Journey/{tomorrow}/{BURLINGTON}/{code}/0000/8", key))
            for item in extra:
                item["nextServiceDay"] = True
            journeys = (journeys + extra)[:API_JOURNEY_LIMIT]
        predicted = attach_predictions(journeys, rows) or predicted
        routes.append({
            "origin": {"label": "Burlington", "stopCode": BURLINGTON},
            "destination": {"label": label, "stopCode": code},
            "journeys": journeys,
        })
    try:
        inbound = normalize_journeys(get_json(f"Schedule/Journey/{date}/{UNION}/{BURLINGTON}/{start}/{API_JOURNEY_LIMIT}", key))
        if len(inbound) < 2:
            extra = normalize_journeys(get_json(f"Schedule/Journey/{tomorrow}/{UNION}/{BURLINGTON}/0000/8", key))
            for item in extra:
                item["nextServiceDay"] = True
            inbound = (inbound + extra)[:API_JOURNEY_LIMIT]
        inbound_pred = attach_predictions(inbound, rows)
        predicted = inbound_pred or predicted
        routes.append({
            "origin": {"label": "Union", "stopCode": UNION},
            "destination": {"label": "Burlington", "stopCode": BURLINGTON},
            "direction": "inbound",
            "journeys": inbound,
        })
    except Exception as exc:
        print(f"GO inbound schedule unavailable: {type(exc).__name__}: {exc}")
    try:
        alerts = relevant_alerts(get_json("ServiceUpdate/ServiceAlert/All", key))
    except Exception as exc:
        print(f"GO alerts unavailable: {type(exc).__name__}: {exc}")
        alerts = []
    return {
        "generatedAt": now.isoformat(),
        "source": "Metrolinx GO API",
        "sourceUrl": "https://api.openmetrolinx.com/OpenDataAPI/Help",
        "dataKind": "realtime" if predicted else "scheduled",
        "route": "Lakeshore West",
        "lineCode": LINE,
        "routes": routes,
        "alerts": alerts,
        "liveStatusUrl": "https://www.gotransit.com/en/see-schedules",
    }


def read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
    with zf.open(name) as handle:
        return list(csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig")))


def active_services(calendar: list[dict], exceptions: list[dict], today: dt.date) -> set[str]:
    day = today.strftime("%A").lower()
    ymd = today.strftime("%Y%m%d")
    active = {
        row["service_id"] for row in calendar
        if row.get(day) == "1" and row.get("start_date", "99999999") <= ymd <= row.get("end_date", "00000000")
    }
    for row in exceptions:
        if row.get("date") != ymd:
            continue
        if row.get("exception_type") == "1":
            active.add(row["service_id"])
        elif row.get("exception_type") == "2":
            active.discard(row["service_id"])
    return active


def seconds(value: str) -> int:
    try:
        h, m, s = (int(part) for part in value.split(":"))
        return h * 3600 + m * 60 + s
    except Exception:
        return -1


def pretty_duration(start: str, end: str) -> str:
    diff = seconds(end) - seconds(start)
    if diff < 0:
        return ""
    minutes = diff // 60
    return f"{minutes} min"


def collect_gtfs_journeys(stop_ids: dict[str, str], eligible_trips: dict, grouped: dict, now_sec: int) -> list[dict]:
    route_payloads = []
    for label, code in TARGETS:
        destination_id = stop_ids[label]
        candidates = []
        for trip_id, rows in grouped.items():
            rows.sort(key=lambda item: int(item.get("stop_sequence") or 0))
            origin = next((r for r in rows if r.get("stop_id") == stop_ids["Burlington"]), None)
            destination = next((r for r in rows if r.get("stop_id") == destination_id), None)
            if not origin or not destination:
                continue
            if int(destination.get("stop_sequence") or 0) <= int(origin.get("stop_sequence") or 0):
                continue
            departure = origin.get("departure_time") or origin.get("arrival_time") or ""
            arrival = destination.get("arrival_time") or destination.get("departure_time") or ""
            if seconds(departure) < now_sec:
                continue
            trip = eligible_trips[trip_id]
            candidates.append({
                "departure": departure,
                "arrival": arrival,
                "duration": pretty_duration(departure, arrival),
                "line": LINE,
                "type": "Train",
                "tripNumber": trip.get("trip_short_name") or trip_id,
                "scheduled": True,
            })
        candidates.sort(key=lambda item: seconds(item["departure"]))
        route_payloads.append({
            "origin": {"label": "Burlington", "stopCode": BURLINGTON},
            "destination": {"label": label, "stopCode": code},
            "journeys": candidates[:GTFS_JOURNEY_LIMIT],
        })
    inbound = []
    origin_id = stop_ids.get("Union")
    dest_id = stop_ids.get("Burlington")
    if origin_id and dest_id:
        for trip_id, rows in grouped.items():
            rows.sort(key=lambda item: int(item.get("stop_sequence") or 0))
            origin = next((r for r in rows if r.get("stop_id") == origin_id), None)
            destination = next((r for r in rows if r.get("stop_id") == dest_id), None)
            if not origin or not destination:
                continue
            if int(destination.get("stop_sequence") or 0) <= int(origin.get("stop_sequence") or 0):
                continue
            departure = origin.get("departure_time") or origin.get("arrival_time") or ""
            arrival = destination.get("arrival_time") or destination.get("departure_time") or ""
            if seconds(departure) < now_sec:
                continue
            trip = eligible_trips[trip_id]
            inbound.append({
                "departure": departure,
                "arrival": arrival,
                "duration": pretty_duration(departure, arrival),
                "line": LINE,
                "type": "Train",
                "tripNumber": trip.get("trip_short_name") or trip_id,
                "scheduled": True,
            })
        inbound.sort(key=lambda item: seconds(item["departure"]))
        route_payloads.append({
            "origin": {"label": "Union", "stopCode": UNION},
            "destination": {"label": "Burlington", "stopCode": BURLINGTON},
            "direction": "inbound",
            "journeys": inbound[:GTFS_JOURNEY_LIMIT],
        })
    return route_payloads


def build_gtfs(now: dt.datetime) -> dict:
    data = request(GTFS_URL)
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        stops = read_csv(zf, "stops.txt")
        routes = read_csv(zf, "routes.txt")
        trips = read_csv(zf, "trips.txt")
        stop_times = read_csv(zf, "stop_times.txt")
        calendar = read_csv(zf, "calendar.txt") if "calendar.txt" in zf.namelist() else []
        exceptions = read_csv(zf, "calendar_dates.txt") if "calendar_dates.txt" in zf.namelist() else []

    stop_ids: dict[str, str] = {}
    for row in stops:
        sid = str(row.get("stop_id") or "").upper()
        code = str(row.get("stop_code") or "").upper()
        name = str(row.get("stop_name") or "").strip()
        if "bus" in name.lower():
            continue
        if sid == BURLINGTON or code == BURLINGTON or name == "Burlington GO":
            stop_ids["Burlington"] = row["stop_id"]
        if sid == UNION or code == UNION or name == "Union Station GO":
            stop_ids["Union"] = row["stop_id"]
        if sid == WEST_HARBOUR or code == WEST_HARBOUR or name == "West Harbour GO":
            stop_ids["West Harbour"] = row["stop_id"]
    if not all(name in stop_ids for name in ("Burlington", "Union", "West Harbour")):
        raise RuntimeError(f"Could not resolve required GTFS stops: {stop_ids}")

    active = active_services(calendar, exceptions, now.date()) if calendar or exceptions else {row["service_id"] for row in trips}
    lw_route_ids = {
        row["route_id"] for row in routes
        if str(row.get("route_short_name") or "").upper() == LINE or "lakeshore west" in str(row.get("route_long_name") or "").lower()
    }
    eligible_trips = {row["trip_id"]: row for row in trips if row.get("service_id") in active and row.get("route_id") in lw_route_ids}
    grouped: dict[str, list[dict]] = {}
    for row in stop_times:
        trip_id = row.get("trip_id")
        if trip_id in eligible_trips:
            grouped.setdefault(trip_id, []).append(row)

    now_sec = now.hour * 3600 + now.minute * 60 + now.second
    route_payloads = collect_gtfs_journeys(stop_ids, eligible_trips, grouped, now_sec)

    # Late evening can leave few current-day trips. Add verified next-service-day
    # rows rather than inventing a cadence.
    if any(len(route.get("journeys") or []) < 4 for route in route_payloads):
        next_day = now.date() + dt.timedelta(days=1)
        next_active = active_services(calendar, exceptions, next_day) if calendar or exceptions else {row["service_id"] for row in trips}
        next_trips = {row["trip_id"]: row for row in trips if row.get("service_id") in next_active and row.get("route_id") in lw_route_ids}
        next_grouped: dict[str, list[dict]] = {}
        for row in stop_times:
            trip_id = row.get("trip_id")
            if trip_id in next_trips:
                next_grouped.setdefault(trip_id, []).append(row)
        extra = collect_gtfs_journeys(stop_ids, next_trips, next_grouped, 0)
        for current, later in zip(route_payloads, extra):
            seen = {(item.get("departure"), item.get("tripNumber")) for item in current.get("journeys") or []}
            for item in later.get("journeys") or []:
                key = (item.get("departure"), item.get("tripNumber"))
                if key in seen:
                    continue
                item = dict(item)
                item["nextServiceDay"] = True
                current.setdefault("journeys", []).append(item)
                seen.add(key)
            current["journeys"] = current.get("journeys", [])[:GTFS_JOURNEY_LIMIT]

    return {
        "generatedAt": now.isoformat(),
        "source": "Metrolinx GO Transit GTFS",
        "sourceUrl": "https://www.gotransit.com/en/partner-with-us/software-developers",
        "dataKind": "scheduled",
        "route": "Lakeshore West",
        "lineCode": LINE,
        "routes": route_payloads,
        "alerts": [],
        "liveStatusUrl": "https://www.gotransit.com/en/see-schedules",
        "attribution": "Data used in this product or service is provided with the permission of Metrolinx. Metrolinx makes no representations or warranties of any kind, express or implied, with respect to the Data and assumes no responsibility for the accuracy or currency of the data used in this product or service.",
    }


def main() -> int:
    now = dt.datetime.now(TZ)
    key = os.environ.get("GO_API_KEY", "").strip()
    try:
        payload = build_api(key, now) if key else build_gtfs(now)
    except Exception as exc:
        if key:
            print(f"GO API failed; trying public GTFS schedule: {type(exc).__name__}: {exc}")
            payload = build_gtfs(now)
        else:
            raise
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated GO status from {payload['source']} ({payload['dataKind']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
