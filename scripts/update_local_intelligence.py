#!/usr/bin/env python3
"""Build Burlington's live local intelligence feed from official sources.

The output is intentionally factual and rule based. It powers utility surfaces and
creates editorial leads, but never auto-publishes an article or invents a status.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "local-intelligence.json"
PREVIOUS = DATA / "local-intelligence-previous.json"
LEADS = DATA / "local-leads.json"
TZ = dt.timezone(dt.timedelta(hours=-4))
USER_AGENT = "BurlingtonNews/2.1 (+https://burlingtonnews.ca/)"

EVENT_URL = "https://511on.ca/api/v2/get/event?format=json&lang=en"
CAMERA_URL = "https://511on.ca/api/v2/get/camera?format=json&lang=en"
BT_ALERTS = "https://opendata.burlington.ca/gtfs-rt/ServiceAlerts.json"
BT_TRIPS = "https://opendata.burlington.ca/gtfs-rt/TripUpdates.json"
BT_VEHICLES = "https://opendata.burlington.ca/gtfs-rt/VehiclePositions.json"

# Approximate city bounds. Nearby highway events get a slightly wider envelope.
BURLINGTON = {"south": 43.29, "north": 43.48, "west": -79.95, "east": -79.68}
HIGHWAY = {"south": 43.25, "north": 43.52, "west": -80.02, "east": -79.61}
CENTRE = (43.36, -79.80)

NEIGHBOURHOODS = [
    ("Aldershot", 43.313, -79.846), ("Downtown", 43.325, -79.799),
    ("Roseland", 43.344, -79.779), ("Shoreacres", 43.362, -79.751),
    ("Elizabeth Gardens", 43.374, -79.730), ("Tyandaga", 43.358, -79.846),
    ("Mountainside", 43.354, -79.817), ("Brant Hills", 43.382, -79.831),
    ("Headon Forest", 43.379, -79.805), ("Palmer", 43.369, -79.793),
    ("Millcroft", 43.390, -79.769), ("Orchard", 43.403, -79.752),
    ("Alton Village", 43.407, -79.807), ("Tansley", 43.381, -79.775),
]


def fetch_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def safe_fetch(url: str, default):
    try:
        return fetch_json(url), "ok"
    except Exception as exc:
        return default, f"error:{type(exc).__name__}"


def number(value):
    try: return float(value)
    except (TypeError, ValueError): return None


def coordinates(item):
    lat = number(item.get("Latitude") or item.get("latitude") or item.get("Lat"))
    lon = number(item.get("Longitude") or item.get("longitude") or item.get("Lon"))
    if lat is not None and lon is not None: return lat, lon
    geometry = item.get("geometry") or item.get("Geometry") or {}
    coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if isinstance(coords, list) and len(coords) >= 2:
        return number(coords[1]), number(coords[0])
    return None, None


def in_bounds(lat, lon, bounds):
    return lat is not None and lon is not None and bounds["south"] <= lat <= bounds["north"] and bounds["west"] <= lon <= bounds["east"]


def distance_km(a, b):
    lat1, lon1 = a; lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    h = math.sin(dlat/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlon/2)**2
    return 6371 * 2 * math.atan2(math.sqrt(h), math.sqrt(1-h))


def neighbourhood(lat, lon):
    if not in_bounds(lat, lon, BURLINGTON): return "Burlington area"
    return min(NEIGHBOURHOODS, key=lambda n: distance_km((lat, lon), (n[1], n[2])))[0]


def text(item):
    fields = ("RoadwayName", "EventType", "EventSubType", "Description", "Location", "DirectionOfTravel", "Comment")
    return " ".join(str(item.get(k) or "") for k in fields).strip()


def burlington_event(item):
    hay = text(item).lower()
    lat, lon = coordinates(item)
    local_words = ("burlington", "skyway", "brant", "guelph line", "walkers line", "appleby", "burloak", "fairview", "plains road", "north shore")
    highway_words = ("qew", "queen elizabeth", "highway 403", "hwy 403", "407")
    return in_bounds(lat, lon, BURLINGTON) or any(w in hay for w in local_words) or (in_bounds(lat, lon, HIGHWAY) and any(w in hay for w in highway_words))


def severity(item):
    hay = text(item).lower()
    score = 35
    if any(x in hay for x in ("all lanes closed", "road closed", "full closure", "highway closed")): score += 45
    elif any(x in hay for x in ("collision", "crash", "incident")): score += 30
    elif any(x in hay for x in ("lane closed", "lanes closed", "blocked")): score += 22
    elif any(x in hay for x in ("construction", "maintenance")): score += 8
    if any(x in hay for x in ("qew", "skyway", "403", "407")): score += 10
    if any(x in hay for x in ("major", "serious", "emergency")): score += 10
    return min(100, score)


def normalize_event(item):
    lat, lon = coordinates(item)
    headline = str(item.get("Description") or item.get("EventSubType") or item.get("EventType") or "Traffic incident").strip()
    roadway = str(item.get("RoadwayName") or item.get("Location") or "Burlington").strip()
    event_id = str(item.get("ID") or item.get("Id") or item.get("EventId") or hashlib.sha1(text(item).encode()).hexdigest()[:12])
    return {
        "id": f"511:{event_id}", "kind": "traffic", "headline": headline, "location": roadway,
        "direction": str(item.get("DirectionOfTravel") or "").strip(), "score": severity(item),
        "neighbourhood": neighbourhood(lat, lon), "latitude": lat, "longitude": lon,
        "source": "Ontario 511", "sourceUrl": "https://511on.ca/", "url": "skyway-traffic.html",
        "rawType": str(item.get("EventType") or "").strip(),
    }


def listish(payload):
    if isinstance(payload, list): return payload
    if not isinstance(payload, dict): return []
    for key in ("items", "Items", "events", "Events", "cameras", "Cameras"):
        if isinstance(payload.get(key), list): return payload[key]
    return []


def normalize_cameras(payload):
    result = []
    for camera in listish(payload):
        lat, lon = coordinates(camera)
        hay = " ".join(str(camera.get(k) or "") for k in ("Roadway", "RoadwayName", "Name", "Location", "Description")).lower()
        if not (in_bounds(lat, lon, HIGHWAY) or any(x in hay for x in ("burlington", "skyway", "brant", "guelph", "appleby"))): continue
        cid = str(camera.get("ID") or camera.get("Id") or camera.get("CameraId") or "")
        result.append({
            "id": cid, "name": str(camera.get("Name") or camera.get("Description") or camera.get("Location") or "Ontario 511 camera"),
            "roadway": str(camera.get("RoadwayName") or camera.get("Roadway") or ""), "latitude": lat, "longitude": lon,
            "imageUrl": camera.get("Url") or camera.get("ImageUrl") or camera.get("Image") or (f"https://511on.ca/map/Cctv/{cid}" if cid else ""),
            "source": "Ontario 511",
        })
    return result[:12]


def entities(payload):
    if isinstance(payload, dict):
        if isinstance(payload.get("entity"), list): return payload["entity"]
        if isinstance(payload.get("Entity"), list): return payload["Entity"]
    return []


def translation(value):
    if isinstance(value, str): return value
    if not isinstance(value, dict): return ""
    rows = value.get("translation") or value.get("Translation") or []
    if isinstance(rows, dict): rows = [rows]
    for row in rows:
        if isinstance(row, dict) and row.get("text"): return str(row["text"])
    return ""


def transit_alerts(payload):
    alerts = []
    for entity in entities(payload):
        alert = entity.get("alert") or entity.get("Alert") or {}
        if not alert: continue
        headline = translation(alert.get("headerText") or alert.get("header_text")) or "Burlington Transit service alert"
        detail = translation(alert.get("descriptionText") or alert.get("description_text"))
        effect = str(alert.get("effect") or "").replace("_", " ").title()
        aid = str(entity.get("id") or hashlib.sha1((headline+detail).encode()).hexdigest()[:12])
        score = 72 if any(x in f"{headline} {detail} {effect}".lower() for x in ("no service", "suspend", "cancel", "closed")) else 58
        alerts.append({"id": f"bt:{aid}", "kind": "transit", "headline": headline, "detail": detail, "effect": effect, "score": score, "neighbourhood": "Burlington", "source": "Burlington Transit", "sourceUrl": "https://www.burlington.ca/en/transit/transit.aspx", "url": "https://www.burlington.ca/en/transit/service-alerts.aspx"})
    return alerts


def count_entities(payload): return len(entities(payload))


def stable_signature(item):
    return hashlib.sha1(json.dumps({k:item.get(k) for k in ("kind","headline","location","effect","neighbourhood")}, sort_keys=True).encode()).hexdigest()[:16]


def load(path, default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception: return default


def main():
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    events_raw, event_status = safe_fetch(EVENT_URL, [])
    cameras_raw, camera_status = safe_fetch(CAMERA_URL, [])
    alerts_raw, alerts_status = safe_fetch(BT_ALERTS, {})
    trips_raw, trips_status = safe_fetch(BT_TRIPS, {})
    vehicles_raw, vehicles_status = safe_fetch(BT_VEHICLES, {})

    traffic = [normalize_event(x) for x in listish(events_raw) if burlington_event(x)]
    transit = transit_alerts(alerts_raw)
    signals = sorted(traffic + transit, key=lambda x: x["score"], reverse=True)
    for item in signals: item["signature"] = stable_signature(item)

    previous = load(OUT, {})
    previous_signatures = {x.get("signature") for x in previous.get("signals", [])}
    new_signals = [x for x in signals if x["signature"] not in previous_signatures]
    leads = []
    for item in new_signals:
        if item["score"] < 65: continue
        leads.append({
            "id": item["id"], "detectedAt": now.isoformat().replace("+00:00", "Z"), "score": item["score"],
            "headline": item["headline"], "kind": item["kind"], "location": item.get("location") or item.get("neighbourhood"),
            "source": item["source"], "sourceUrl": item["sourceUrl"], "status": "review", "reason": "New high-priority official-source change detected. Verify before turning this into an article."
        })

    payload = {
        "version": 1, "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "method": "Official-source, rule-based local utility monitor. Signals are ranked; articles still require editorial review.",
        "sources": {
            "ontario511Events": event_status, "ontario511Cameras": camera_status,
            "burlingtonTransitAlerts": alerts_status, "burlingtonTransitTrips": trips_status, "burlingtonTransitVehicles": vehicles_status,
        },
        "summary": {"activeSignals": len(signals), "trafficIncidents": len(traffic), "transitAlerts": len(transit), "transitTripUpdates": count_entities(trips_raw), "transitVehicles": count_entities(vehicles_raw)},
        "signals": signals[:30], "topSignal": signals[0] if signals else None,
        "traffic": {"incidents": traffic[:25], "cameras": normalize_cameras(cameras_raw)},
        "transit": {"alerts": transit[:15], "tripUpdateCount": count_entities(trips_raw), "vehicleCount": count_entities(vehicles_raw)},
    }
    DATA.mkdir(parents=True, exist_ok=True)
    if OUT.exists(): PREVIOUS.write_text(OUT.read_text(encoding="utf-8"), encoding="utf-8")
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    existing = load(LEADS, {"items": []}).get("items", [])
    seen = {x.get("id") for x in existing}
    merged = [x for x in leads if x.get("id") not in seen] + existing
    LEADS.write_text(json.dumps({"generatedAt": payload["generatedAt"], "items": merged[:100]}, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")


if __name__ == "__main__": main()
