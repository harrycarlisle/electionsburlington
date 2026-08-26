#!/usr/bin/env python3
"""Build route-aware Burlington traffic surface from official 511 data + geometry."""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import urllib.request
from zoneinfo import ZoneInfo

import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from traffic_context import (  # noqa: E402
    cameras_along_route,
    combine_looks,
    distance_to_polyline_km,
    haversine_km,
    normalize_incident,
)
DATA = ROOT / "data"
CAMERAS = DATA / "traffic-cameras.json"
ROUTES = DATA / "traffic-routes.json"
OUT = DATA / "traffic-surface.json"
INTEL = DATA / "local-intelligence.json"
EVENT_URL = "https://511on.ca/api/v2/get/event?format=json&lang=en"
OSRM = "https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson"
USER_AGENT = "BurlingtonNews/2.2 (+https://burlingtonnews.ca/)"
TZ = ZoneInfo("America/Toronto")

# Official Ontario 511 camera 228, Location "QEW at Guelph Line".
BURLINGTON_ROUTE_ORIGIN = {
    "label": "QEW at Guelph Line",
    "lat": 43.350991,
    "lon": -79.804387,
    "cameraId": 228,
    "source": "Ontario 511",
}
ORIGINS = {
    "qew": BURLINGTON_ROUTE_ORIGIN,
    "downtown": {"label": "Downtown Burlington", "lat": 43.3255, "lon": -79.7990},
    "go": {"label": "Burlington GO", "lat": 43.3406, "lon": -79.8093},
}
DESTINATIONS = {
    "toronto": {"label": "Toronto", "lat": 43.6455, "lon": -79.3803},
    "oakville": {"label": "Oakville", "lat": 43.4501, "lon": -79.6829},
    "hamilton": {"label": "Hamilton", "lat": 43.2557, "lon": -79.8711},
    "stoney-creek": {"label": "Stoney Creek", "lat": 43.2168, "lon": -79.6599},
    "niagara-falls": {"label": "Niagara Falls", "lat": 43.0896, "lon": -79.0849},
}


def request_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def load_json(path: pathlib.Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


WESTBOUND_VIA = {
    # Burlington-side QEW before the Skyway, so OSRM stays on the highway
    # instead of looping the harbour to snap to a mid-bridge coordinate.
    "hamilton": [{"lat": 43.31469, "lon": -79.80572}],
    "stoney-creek": [{"lat": 43.31469, "lon": -79.80572}, {"lat": 43.24683, "lon": -79.75679}],
    "niagara-falls": [{"lat": 43.31469, "lon": -79.80572}, {"lat": 43.24683, "lon": -79.75679}],
}


def fetch_route(origin, dest, vias=None):
    points = [origin, *(vias or []), dest]
    coords = ";".join(f"{point['lon']},{point['lat']}" for point in points)
    payload = request_json(OSRM.format(coords=coords))
    route = (payload.get("routes") or [None])[0]
    if not route:
        raise RuntimeError("OSRM returned no route")
    line = route["geometry"]["coordinates"]
    return [[lat, lon] for lon, lat in line], float(route.get("distance") or 0)


def relevant_incidents(events, cameras):
    normalized = []
    for event in events:
        item = {
            "id": f"511:{event.get('ID') or event.get('Id')}",
            "headline": event.get("Description") or event.get("EventSubType") or event.get("EventType"),
            "Description": event.get("Description"),
            "EventType": event.get("EventType"),
            "EventSubType": event.get("EventSubType"),
            "RoadwayName": event.get("RoadwayName"),
            "Location": event.get("Location"),
            "DirectionOfTravel": event.get("DirectionOfTravel"),
            "latitude": event.get("Latitude"),
            "longitude": event.get("Longitude"),
            "LastUpdated": event.get("LastUpdated") or event.get("StartTime"),
            "source": "Ontario 511",
        }
        hay = " ".join(str(event.get(k) or "") for k in ("Description", "RoadwayName", "Location", "EventType")).lower()
        lat, lon = item["latitude"], item["longitude"]
        try:
            lat = float(lat) if lat is not None else None
            lon = float(lon) if lon is not None else None
        except (TypeError, ValueError):
            lat = lon = None
        near_camera = False
        if lat is not None:
            near_camera = any(
                haversine_km((lat, lon), (c["latitude"], c["longitude"])) <= 6
                for c in cameras if c.get("latitude") is not None
            )
            corridor = any(word in hay for word in (
            "burlington", "skyway", "brant street", "guelph line", "walkers line",
            "appleby", "burloak", "fairview", "plains road", "eastport", "qew",
            "oakville", "hamilton", "stoney creek", "niagara", "mississauga",
            "etobicoke", "gardiner", "hurontario", "cawthra", "dixie"
        ))
        in_box = lat is not None and 43.05 <= lat <= 43.66 and -80.00 <= lon <= -79.30
        if not (near_camera or (corridor and in_box)):
            continue
        if lat is not None and lon is not None and lon < -79.93 and "skyway" not in hay and "qew" not in hay:
            continue
        normalized.append(normalize_incident(item))
    normalized.sort(key=lambda item: (
        0 if item["type"] in {"collision", "closure"} else 1,
        -item["score"],
        item["municipality"] != "Burlington",
    ))
    return normalized


def incident_on_route(incident, line):
    if incident.get("latitude") is None:
        hay = f"{incident.get('title')} {incident.get('nearestRoad')} {incident.get('municipality')}".lower()
        return any(token in hay for token in ("qew", "skyway", "brant", "guelph", "walkers", "appleby", "burloak", "dorval", "oakville", "hamilton"))
    dist, _ = distance_to_polyline_km((incident["latitude"], incident["longitude"]), line)
    return dist <= 2.2


def route_status(incidents, looks):
    serious = [item for item in incidents if item["type"] in {"collision", "closure"}]
    if serious:
        lead = serious[0]
        return {
            "level": "delay",
            "headline": "Delay likely" if lead["type"] == "collision" else "Delay likely",
            "detail": lead["title"],
            "looks": combine_looks(looks) or "",
        }
    looks_label = combine_looks(looks)
    if looks_label:
        return {"level": looks_label, "headline": f"Traffic looks {looks_label}", "detail": "", "looks": looks_label}
    return {"level": "unknown", "headline": "Check cameras", "detail": "No current camera estimate.", "looks": ""}


def skyway_status(incidents, cameras):
    skyway_incidents = [item for item in incidents if item.get("affectsSkyway") and item["type"] in {"collision", "closure"}]
    if skyway_incidents:
        lead = skyway_incidents[0]
        return {"value": "Closure" if lead["type"] == "closure" else "Collision", "alert": True, "detail": lead["title"]}
    looks = [c.get("looks") for c in cameras if c.get("cameraId") in {4, 219, 220} or "Skyway" in str(c.get("cameraName") or "")]
    label = combine_looks(looks)
    if label:
        return {"value": label.title(), "alert": False, "detail": f"Traffic looks {label}"}
    return {"value": "Check cameras", "alert": False, "detail": ""}


def main() -> int:
    now = dt.datetime.now(TZ)
    camera_pack = load_json(CAMERAS, {"cameras": []})
    cameras = camera_pack.get("cameras") or []
    estimates = {str(item.get("viewId") or item.get("cameraId")): item for item in (load_json(DATA / "traffic-estimates.json", {}).get("cameras") or [])}
    for camera in cameras:
        key = str(camera.get("viewId") or camera.get("cameraId"))
        est = estimates.get(key) or estimates.get(str(camera.get("cameraId")))
        camera["looks"] = (est or {}).get("traffic") or ""
        camera["looksConfidence"] = (est or {}).get("confidence")
    try:
        events = request_json(EVENT_URL)
        if isinstance(events, dict):
            events = events.get("events") or events.get("Events") or []
    except Exception as exc:
        print(f"511 events unavailable: {type(exc).__name__}: {exc}")
        events = []
    incidents = relevant_incidents(events if isinstance(events, list) else [], cameras)

    stored_routes = load_json(ROUTES, {"routes": {}})
    routes_out = {}
    route_polylines = {}
    for dest_id, dest in DESTINATIONS.items():
        origin = ORIGINS["qew"]
        line = None
        source = "osrm"
        try:
            line, metres = fetch_route(origin, dest, WESTBOUND_VIA.get(dest_id))
        except Exception as exc:
            print(f"OSRM {dest_id} failed: {type(exc).__name__}: {exc}")
            cached = (stored_routes.get("routes") or {}).get(dest_id)
            line = (cached or {}).get("polyline")
            metres = (cached or {}).get("metres") or 0
            source = "cached-polyline" if line else "none"
        if not line:
            continue
        matched = cameras_along_route(cameras, line)
        route_incidents = [item for item in incidents if incident_on_route(item, line)]
        looks = [cam.get("looks") for cam in matched]
        status = route_status(route_incidents, looks)
        routes_out[dest_id] = {
            "id": dest_id,
            "label": dest["label"],
            "origin": origin["label"],
            "destination": dest["label"],
            "geometrySource": source,
            "metres": metres,
            "status": status,
            "incidents": route_incidents[:3],
            "cameras": [
                {
                    "cameraId": cam.get("cameraId"),
                    "viewId": cam.get("viewId"),
                    "cameraName": cam.get("cameraName"),
                    "viewName": cam.get("viewName"),
                    "looks": cam.get("looks") or "",
                    "routeOrder": cam.get("routeOrder"),
                }
                for cam in matched
            ],
        }
        route_polylines[dest_id] = {"polyline": line, "metres": metres, "source": source}

    commute_id = "hamilton" if now.hour >= 15 else "toronto"
    commute = routes_out.get(commute_id) or routes_out.get("toronto", {})
    homepage_traffic = None
    homepage_incidents = [
        item for item in incidents
        if item["type"] in {"collision", "closure"}
        and item["municipality"] in {"Burlington", "Oakville", "Hamilton", "Stoney Creek"}
    ]
    if homepage_incidents:
        lead = homepage_incidents[0]
        homepage_traffic = {
            "label": "Traffic",
            "title": lead["title"],
            "context": " · ".join(part for part in (lead["municipality"], lead["nearestRoad"], lead.get("updatedLabel")) if part),
            "impact": lead["impact"],
            "freshness": lead.get("updatedLabel") or "",
            "url": "/traffic/",
            "alert": True,
        }
    elif commute.get("status", {}).get("looks"):
        dest_label = commute.get("label") or commute_id.replace("-", " ").title()
        homepage_traffic = {
            "label": "Traffic",
            "title": f"{commute['status']['looks'].title()} toward {dest_label}",
            "context": f"QEW at Guelph Line → {dest_label}",
            "impact": "",
            "freshness": "",
            "url": "/traffic/",
            "alert": False,
        }

    payload = {
        "generatedAt": now.isoformat(),
        "source": "Ontario 511 events + OSRM geometry + camera inventory",
        "licence": "Open Government Licence - Ontario",
        "incidents": incidents[:12],
        "skyway": skyway_status(incidents, cameras),
        "homepageTraffic": homepage_traffic,
        "routes": routes_out,
        "attribution": "Map routes from OpenStreetMap via OSRM. Camera and incident data © King's Printer for Ontario.",
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    route_store = {
        "updated": now.date().isoformat(),
        "origin": ORIGINS["qew"],
        "destinations": DESTINATIONS,
        "routes": route_polylines,
    }
    ROUTES.write_text(json.dumps(route_store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Traffic surface: {len(incidents)} incidents, {len(routes_out)} routes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
