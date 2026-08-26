#!/usr/bin/env python3
"""Reusable Burlington traffic geography and incident normalizer."""
from __future__ import annotations

import datetime as dt
import math
import re

LANDMARKS = [
    {"name": "Brant Street", "query": "Brant Street", "lat": 43.3413, "lon": -79.8220, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Guelph Line", "query": "Guelph Line", "lat": 43.3510, "lon": -79.8044, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Walkers Line", "query": "Walkers Line", "lat": 43.3660, "lon": -79.7878, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Appleby Line", "query": "Appleby Line", "lat": 43.3806, "lon": -79.7719, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Burloak Drive", "query": "Burloak Drive", "lat": 43.3948, "lon": -79.7563, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Fairview Street", "query": "Fairview Street", "lat": 43.3278, "lon": -79.8249, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Plains Road", "query": "Plains Road", "lat": 43.3275, "lon": -79.8255, "municipality": "Burlington", "kind": "interchange"},
    {"name": "North Shore Boulevard", "query": "North Shore", "lat": 43.3151, "lon": -79.8074, "municipality": "Burlington", "kind": "interchange"},
    {"name": "Burlington Skyway", "query": "Skyway", "lat": 43.3092, "lon": -79.8031, "municipality": "Burlington", "kind": "bridge"},
    {"name": "Eastport Drive", "query": "Eastport", "lat": 43.2845, "lon": -79.7875, "municipality": "Hamilton", "kind": "interchange"},
    {"name": "Woodward Avenue", "query": "Woodward", "lat": 43.2650, "lon": -79.7722, "municipality": "Hamilton", "kind": "interchange"},
    {"name": "Nikola Tesla Boulevard", "query": "Nikola Tesla", "lat": 43.2585, "lon": -79.7670, "municipality": "Hamilton", "kind": "interchange"},
    {"name": "Centennial Parkway", "query": "Centennial", "lat": 43.2468, "lon": -79.7568, "municipality": "Hamilton", "kind": "interchange"},
    {"name": "Bronte Road", "query": "Bronte", "lat": 43.4093, "lon": -79.7408, "municipality": "Oakville", "kind": "interchange"},
    {"name": "Third Line", "query": "Third Line", "lat": 43.4239, "lon": -79.7253, "municipality": "Oakville", "kind": "interchange"},
    {"name": "Dorval Drive", "query": "Dorval", "lat": 43.4462, "lon": -79.6998, "municipality": "Oakville", "kind": "interchange"},
    {"name": "Trafalgar Road", "query": "Trafalgar", "lat": 43.4610, "lon": -79.6836, "municipality": "Oakville", "kind": "interchange"},
    {"name": "Ford Drive", "query": "Ford Drive", "lat": 43.4946, "lon": -79.6722, "municipality": "Oakville", "kind": "interchange"},
    {"name": "Downtown Burlington", "query": "Downtown", "lat": 43.3255, "lon": -79.7990, "municipality": "Burlington", "kind": "place"},
    {"name": "Burlington GO", "query": "Burlington GO", "lat": 43.3406, "lon": -79.8093, "municipality": "Burlington", "kind": "place"},
]

SKYWAY = {"lat": 43.3025, "lon": -79.7995}


def haversine_km(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def point_to_segment_km(point, start, end):
    """Approximate shortest distance from a lat/lon to a segment, in km."""
    lat, lon = point
    lat1, lon1 = start
    lat2, lon2 = end
    # Equirectangular local projection around the segment.
    mid_lat = math.radians((lat1 + lat2) / 2)
    def xy(la, lo):
        return ((lo - lon1) * math.cos(mid_lat) * 111.32, (la - lat1) * 110.57)
    px, py = xy(lat, lon)
    ax, ay = 0.0, 0.0
    bx, by = xy(lat2, lon2)
    abx, aby = bx - ax, by - ay
    denom = abx * abx + aby * aby
    t = 0.0 if denom == 0 else max(0.0, min(1.0, (px * abx + py * aby) / denom))
    qx, qy = ax + t * abx, ay + t * aby
    return math.hypot(px - qx, py - qy), t


def distance_to_polyline_km(point, line):
    if not line:
        return float("inf"), -1
    if len(line) == 1:
        return haversine_km(point, tuple(line[0])), 0
    best = float("inf")
    best_i = 0
    for i in range(len(line) - 1):
        dist, _ = point_to_segment_km(point, tuple(line[i]), tuple(line[i + 1]))
        if dist < best:
            best = dist
            best_i = i
    return best, best_i


def nearest_landmark(lat, lon, hay=""):
    text = hay.lower()
    named = None
    for item in LANDMARKS:
        if item["query"].lower() in text:
            named = item
            break
    if lat is None or lon is None:
        return named
    geo = min(LANDMARKS, key=lambda item: haversine_km((lat, lon), (item["lat"], item["lon"])))
    if named and haversine_km((lat, lon), (named["lat"], named["lon"])) < 8:
        return named
    if haversine_km((lat, lon), (geo["lat"], geo["lon"])) <= 4:
        return geo
    return named


def cross_street_from_text(hay):
    match = re.search(r"\bat\s+([^.,]+?)(?:,|\.|$)", hay, re.I)
    if not match:
        return ""
    value = re.sub(r"\s+", " ", match.group(1)).strip(" -")
    if len(value) < 3 or len(value) > 48:
        return ""
    return value.title().replace("Qew", "QEW").replace("Hwy", "Hwy")


def municipality_for(lat, lon, hay=""):
    text = hay.lower()
    if "oakville" in text:
        return "Oakville"
    if "mississauga" in text:
        return "Mississauga"
    if "stoney creek" in text:
        return "Stoney Creek"
    if "niagara" in text:
        return "Niagara"
    if "hamilton" in text and "burlington" not in text:
        return "Hamilton"
    if "burlington" in text:
        return "Burlington"
    if lat is None or lon is None:
        return ""
    if lat < 43.205 and lon > -79.55:
        return "Niagara"
    if lat < 43.24 and lon > -79.72:
        return "Grimsby" if lon > -79.62 else "Stoney Creek"
    if lon > -79.72 or lat > 43.407:
        return "Oakville"
    if lat < 43.292:
        return "Hamilton" if lon < -79.74 else "Stoney Creek"
    if lon < -79.86:
        return "Hamilton"
    return "Burlington"


def direction_label(value, hay=""):
    text = f"{value} {hay}".lower()
    if "toronto" in text:
        return "Toronto-bound"
    if "fort erie" in text or "niagara" in text:
        return "Fort Erie-bound"
    if "eastbound" in text or "east bound" in text:
        return "eastbound"
    if "westbound" in text or "west bound" in text:
        return "westbound"
    if "northbound" in text:
        return "northbound"
    if "southbound" in text:
        return "southbound"
    return str(value or "").strip()


def roadway_label(value, hay=""):
    official = str(value or "").upper()
    text = f"{value} {hay}".upper()
    if "SKYWAY" in official:
        return "Burlington Skyway"
    if "QEW" in official or "QUEEN ELIZABETH" in official:
        return "QEW"
    if "403" in official:
        return "Highway 403"
    if "407" in official:
        return "Highway 407"
    if re.search(r"\bHWY 6\b|HIGHWAY 6", official):
        return "Highway 6"
    if "SKYWAY" in text and "BETWEEN" not in text:
        return "Burlington Skyway"
    if "QEW" in text or "QUEEN ELIZABETH" in text:
        return "QEW"
    if "403" in text:
        return "Highway 403"
    return str(value or "Local road").strip().title()


def event_kind(hay):
    text = hay.lower()
    if any(x in text for x in ("collision", "crash", "accident")):
        return "collision"
    if any(x in text for x in ("all lanes closed", "road closed", "full closure")):
        return "closure"
    if "on-ramp" in text or "on ramp" in text or "off-ramp" in text or "off ramp" in text:
        if "closed" in text:
            return "closure"
    if "construction" in text:
        return "construction"
    if "maintenance" in text:
        return "maintenance"
    return "notice"


def facility(hay):
    text = hay.lower()
    if "off-ramp" in text or "off ramp" in text:
        return "off-ramp"
    if "on-ramp" in text or "on ramp" in text:
        return "on-ramp"
    return "mainline"


def impact_line(direction, municipality, landmark, kind, roadway):
    place = landmark or municipality or "the area"
    if roadway == "Burlington Skyway" or (landmark == "Burlington Skyway"):
        return "Could affect Skyway crossings between Burlington and Hamilton."
    if direction == "Toronto-bound":
        return "Could affect trips from Burlington toward Oakville or Toronto."
    if direction == "Fort Erie-bound":
        return "Could affect trips from Burlington toward Hamilton or Niagara."
    if municipality in {"Oakville", "Mississauga"}:
        return "Could affect trips from Burlington toward Toronto."
    if municipality in {"Hamilton", "Stoney Creek", "Niagara"}:
        return "Could affect trips from Burlington toward Hamilton."
    if kind in {"collision", "closure"}:
        return f"Watch for delays near {place}."
    return ""


def title_for(kind, roadway, direction, landmark, facility_name):
    place = landmark or roadway
    if facility_name in {"on-ramp", "off-ramp"}:
        verb = "closed" if kind == "closure" else kind
        heading = f"{roadway} {direction} {facility_name}".strip()
        return f"{heading} {verb} at {place}".replace("  ", " ").strip()
    if kind == "collision":
        return f"Collision on {roadway} near {place}".strip()
    if kind == "closure":
        return f"{roadway} closed near {place}".strip()
    if kind == "construction":
        return f"Construction on {roadway} near {place}".strip()
    if kind == "maintenance":
        return f"Maintenance on {roadway} near {place}".strip()
    return f"{roadway} update near {place}".strip()


def freshness_label(value):
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        stamp = text.replace("Z", "+00:00")
        parsed = dt.datetime.fromisoformat(stamp)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        minutes = int((dt.datetime.now(dt.timezone.utc) - parsed.astimezone(dt.timezone.utc)).total_seconds() // 60)
        if minutes < 0:
            return ""
        if minutes < 2:
            return "1 min ago"
        if minutes < 60:
            return f"{minutes} min ago"
        hours = max(1, minutes // 60)
        return f"{hours} hr ago" if hours < 24 else ""
    except Exception:
        return ""


def normalize_incident(item):
    hay = " ".join(str(item.get(k) or "") for k in (
        "headline", "Description", "EventType", "EventSubType", "RoadwayName",
        "Location", "DirectionOfTravel", "direction", "location", "Comment"
    ))
    lat = item.get("latitude") if item.get("latitude") is not None else item.get("Latitude")
    lon = item.get("longitude") if item.get("longitude") is not None else item.get("Longitude")
    try:
        lat = float(lat) if lat is not None else None
        lon = float(lon) if lon is not None else None
    except (TypeError, ValueError):
        lat = lon = None
    landmark = nearest_landmark(lat, lon, hay)
    landmark_name = landmark["name"] if landmark else cross_street_from_text(hay)
    municipality = municipality_for(lat, lon, hay) or (landmark["municipality"] if landmark else "")
    direction = direction_label(item.get("direction") or item.get("DirectionOfTravel") or "", hay)
    roadway = roadway_label(item.get("location") or item.get("RoadwayName") or "", hay)
    kind = event_kind(hay)
    fac = facility(hay)
    title = title_for(kind, roadway, direction, landmark_name, fac)
    context = " · ".join(part for part in (
        municipality,
        " / ".join(part for part in (landmark_name, roadway) if part),
        fac if fac != "mainline" else "",
    ) if part)
    skyway = (
        roadway == "Burlington Skyway"
        or (landmark_name == "Burlington Skyway")
        or "skyway" in hay.lower()
        or (lat is not None and lon is not None and haversine_km((lat, lon), (SKYWAY["lat"], SKYWAY["lon"])) <= 1.6)
    )
    return {
        "id": item.get("id") or item.get("ID"),
        "title": title,
        "rawHeadline": str(item.get("headline") or item.get("Description") or "").strip(),
        "roadway": roadway,
        "direction": direction,
        "type": kind,
        "facility": fac,
        "nearestRoad": landmark_name,
        "municipality": municipality,
        "context": context,
        "impact": impact_line(direction, municipality, landmark_name, kind, roadway),
        "latitude": lat,
        "longitude": lon,
        "score": int(item.get("score") or 0),
        "affectsSkyway": skyway,
        "source": item.get("source") or "Ontario 511",
        "url": "/traffic/",
        "updatedLabel": freshness_label(
            item.get("LastUpdated") or item.get("lastUpdatedAt") or item.get("updated") or item.get("StartTime")
        ),
    }


def cameras_along_route(cameras, line, max_km=1.15):
    matched = []
    for camera in cameras:
        lat, lon = camera.get("latitude"), camera.get("longitude")
        if lat is None or lon is None:
            continue
        dist, index = distance_to_polyline_km((lat, lon), line)
        if dist <= max_km:
            item = dict(camera)
            item["routeKm"] = round(dist, 3)
            item["routeOrder"] = index
            matched.append(item)
    matched.sort(key=lambda item: (item["routeOrder"], item["routeKm"]))
    return matched


def combine_looks(values):
    order = {"heavy": 3, "moderate": 2, "light": 1}
    usable = [v for v in values if v in order]
    if not usable:
        return ""
    if usable.count("heavy") >= 1 and (usable.count("heavy") + usable.count("moderate")) >= max(1, len(usable) // 2):
        return "heavy"
    if "heavy" in usable or usable.count("moderate") >= 1:
        return "moderate" if usable.count("light") >= usable.count("moderate") and "heavy" not in usable else ("heavy" if "heavy" in usable else "moderate")
    return "light"


EASTBOUND_ROUTES = {"toronto", "oakville"}
WESTBOUND_ROUTES = {"hamilton", "stoney-creek", "niagara-falls"}


def travel_direction(route_id):
    return "west" if route_id in WESTBOUND_ROUTES else "east"


def delay_from_incident(item):
    if not item:
        return None
    for key in ("delayMinutes", "delay", "minutes"):
        try:
            value = float(item.get(key))
        except (TypeError, ValueError):
            continue
        if value > 0:
            return int(round(value))
    status = item.get("status") if isinstance(item.get("status"), dict) else {}
    try:
        value = float(status.get("delayMinutes"))
    except (TypeError, ValueError):
        return None
    return int(round(value)) if value > 0 else None


def incident_direction_side(incident):
    hay = f"{incident.get('direction', '')} {incident.get('title', '')} {incident.get('rawHeadline', '')}".lower()
    east = bool(re.search(r"toronto-bound|toronto bound|eastbound|east bound", hay))
    west = bool(re.search(r"fort erie|niagara-bound|hamilton.?bound|westbound|west bound", hay))
    if east and not west:
        return "east"
    if west and not east:
        return "west"
    if "toronto" in hay and not west:
        return "east"
    return "unknown"


def incident_facility_kind(incident):
    named = str(incident.get("facility") or "").lower()
    if named in {"on-ramp", "off-ramp"}:
        return named
    hay = f"{incident.get('title', '')} {incident.get('rawHeadline', '')} {incident.get('facility', '')}".lower()
    if "off-ramp" in hay or "off ramp" in hay:
        return "off-ramp"
    if "on-ramp" in hay or "on ramp" in hay:
        return "on-ramp"
    if re.search(r"\bramp\b", hay):
        return "ramp"
    return "mainline"


def short_incident_place(incident):
    return re.sub(r"\s+(Drive|Rd|Road|Avenue|Ave|Street|St|Boulevard|Blvd|Line)\.?$", "", str(incident.get("nearestRoad") or ""), flags=re.I).strip()


def incident_feature_label(incident):
    if not incident:
        return ""
    facility_name = incident_facility_kind(incident)
    direction = str(incident.get("direction") or "").strip()
    place = incident.get("nearestRoad") or ""
    hay = f"{incident.get('title', '')} {incident.get('rawHeadline', '')}"
    lane = re.search(r"((?:right|left|centre|center|two|three|\d+)\s+(?:mainline\s+)?lanes?)\s+(closed|blocked)", hay, re.I)
    if lane:
        return " ".join(part for part in (direction, f"{lane.group(1).lower()} {lane.group(2).lower()}") if part)
    if facility_name in {"on-ramp", "off-ramp", "ramp"}:
        feature = "ramp" if facility_name == "ramp" else facility_name
        return " ".join(part for part in (direction, f"{feature} closed", f"at {place}" if place else "") if part)
    kind = incident.get("type")
    if kind == "collision":
        return f"Collision near {place}" if place else (incident.get("title") or "Collision")
    if kind == "closure":
        return f"Mainline closure near {place}" if place else (incident.get("title") or "Closure")
    if kind == "construction":
        return f"Construction near {place}" if place else (incident.get("title") or "Construction")
    return incident.get("title") or "Incident"


def incident_matches_route(incident, route_id):
    hay = f"{incident.get('direction', '')} {incident.get('title', '')} {incident.get('rawHeadline', '')}".lower()
    if route_id in EASTBOUND_ROUTES and "fort erie" in hay and "toronto" not in hay:
        return False
    if route_id in WESTBOUND_ROUTES and re.search(r"toronto-bound|toronto bound", hay) and not re.search(r"fort erie|niagara|hamilton", hay):
        return False
    return True


def incident_relevance(incident, route_id):
    if not incident:
        return "none"
    side = incident_direction_side(incident)
    travel = travel_direction(route_id)
    if side != "unknown" and side != travel:
        return "opposite"
    if not incident_matches_route(incident, route_id):
        return "none"
    facility_name = incident_facility_kind(incident)
    if delay_from_incident(incident):
        return "through"
    if facility_name in {"on-ramp", "off-ramp", "ramp"}:
        return "local"
    if incident.get("type") in {"collision", "lanes", "closure"}:
        return "through"
    return "local"


def impact_label(relevance):
    return {
        "local": "Local access affected",
        "opposite": "Opposite direction",
        "through": "Likely affecting traffic",
    }.get(relevance, "")


def official_congestion_trusted(source):
    return bool(re.search(r"travel[- ]?time|speed data|official congestion|mto speed", str(source or ""), re.I))


def _headline_with_place(incident, kind):
    place = short_incident_place(incident or {})
    if not place:
        return {"major": "Major delay", "heavy": "Heavy traffic", "slow": "Some slowing"}.get(kind, "Moving well")
    if kind == "major":
        return f"Major delay near {place}"
    if kind == "heavy":
        return f"Heavy near {place}"
    if kind == "slow":
        return f"Slower near {place}"
    return "Moving well"


def route_drive_status(incidents, route_id, official_status=None, source=""):
    items = [item for item in (incidents or []) if item]
    through = [item for item in items if incident_relevance(item, route_id) == "through"]
    local = [item for item in items if incident_relevance(item, route_id) == "local"]
    delays = [delay_from_incident(item) or 0 for item in items]
    delays.append(delay_from_incident(official_status) or 0)
    official_delay = max(delays) if delays else 0
    looks = str((official_status or {}).get("looks") or "").lower()
    trust_looks = official_congestion_trusted(source) and looks in {"heavy", "moderate", "slow", "light", "clear"}

    headline = "Moving well"
    level = "clear"
    evidence = "no-congestion-data"
    if official_delay >= 20:
        headline, level, evidence = _headline_with_place(through[0] if through else None, "major"), "delay", "official-delay"
    elif official_delay >= 10:
        headline, level, evidence = _headline_with_place(through[0] if through else None, "heavy"), "delay", "official-delay"
    elif official_delay >= 5:
        headline, level, evidence = _headline_with_place(through[0] if through else None, "slow"), "watch", "official-delay"
    elif trust_looks and looks == "heavy":
        headline, level, evidence = _headline_with_place(through[0] if through else None, "heavy"), "delay", "official-congestion"
    elif trust_looks and looks in {"moderate", "slow"}:
        headline, level, evidence = _headline_with_place(through[0] if through else None, "slow"), "watch", "official-congestion"
    elif through:
        lead = through[0]
        place = short_incident_place(lead)
        if lead.get("type") == "closure" and incident_facility_kind(lead) == "mainline":
            headline = f"Heavy near {place}" if place else "Heavy traffic"
            level = "delay"
        else:
            headline = f"Some slowing near {place}" if place else "Some slowing"
            level = "watch"
        evidence = "official-mainline-incident"

    primary = through[0] if through else (local[0] if local else None)
    relevance = incident_relevance(primary, route_id) if primary else "none"
    return {
        "level": level,
        "headline": headline,
        "detail": incident_feature_label(primary) if primary else "",
        "impact": impact_label(relevance),
        "looks": "",
        "evidence": evidence,
        "minutes": official_delay or None,
    }


def decorate_incident(incident, route_id):
    item = dict(incident)
    relevance = incident_relevance(incident, route_id)
    item["relevance"] = relevance
    item["throughTraffic"] = relevance == "through"
    item["impactKind"] = impact_label(relevance)
    item["featureLabel"] = incident_feature_label(incident)
    return item
