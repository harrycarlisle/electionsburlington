#!/usr/bin/env python3
"""Build the Burlington-area Ontario 511 camera inventory with official names."""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from traffic_context import municipality_for, nearest_landmark  # noqa: E402

OUT = ROOT / "data" / "traffic-cameras.json"
CAMERA_URL = "https://511on.ca/api/v2/get/cameras"
USER_AGENT = "BurlingtonNews/2.2 (+https://burlingtonnews.ca/)"

# Official 511 camera IDs that matter for Burlington commuting routes.
# Do not invent names; display names are derived from Location + view Description.
PRIMARY_IDS = {
    4, 219, 220, 217, 218, 224, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235,
    1403, 1404,
}
CORRIDOR_IDS = PRIMARY_IDS | {
    211, 212, 213, 214, 215, 216, 223, 236, 237, 238, 239, 240, 241, 242,
    1411, 1227, 1285, 245, 243,
    # Spaced QEW / Gardiner cameras east of Oakville toward Toronto.
    247, 1159, 250, 252, 254, 256, 258, 260, 799, 797, 795, 786,
}
SKYWAY_VIEW_NAMES = {
    10: "Burlington Skyway — Fort Erie-bound",
    11: "Burlington Skyway — Overhead",
    12: "Burlington Skyway — Toronto-bound",
}
SKYWAY_CAMERA_NAMES = {
    219: "Burlington Skyway — Hamilton side",
    220: "Burlington Skyway — Toronto side",
}


def request_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def nearest_road(location: str) -> str:
    text = str(location or "")
    match = re.search(r"(?:at|east of|west of|north of|south of|near)\s+(.+)$", text, re.I)
    if match:
        return match.group(1).replace(" (East)", "").replace(" (West)", "").strip(" -")
    if "Skyway" in text:
        return "Burlington Skyway"
    return text.replace("QEW ", "").strip()


def direction_from_view(description: str, location: str) -> str:
    hay = f"{description} {location}".lower()
    if "toronto bound" in hay or "toronto-bound" in hay:
        return "Toronto-bound"
    if "fort erie" in hay:
        return "Fort Erie-bound"
    if "looking down" in hay or "overhead" in hay:
        return "Overhead"
    if "hamilton side" in hay:
        return "Hamilton side"
    if "toronto side" in hay:
        return "Toronto side"
    return str(description or "").strip()


def official_name(location: str, view_id: int, camera_id: int) -> str:
    if view_id in SKYWAY_VIEW_NAMES:
        return SKYWAY_VIEW_NAMES[view_id]
    if camera_id in SKYWAY_CAMERA_NAMES:
        return SKYWAY_CAMERA_NAMES[camera_id]
    return str(location or "").strip() or "QEW camera"


def display_name(location: str, view_id: int, camera_id: int) -> str:
    if view_id in SKYWAY_VIEW_NAMES:
        return SKYWAY_VIEW_NAMES[view_id]
    if camera_id in SKYWAY_CAMERA_NAMES:
        return SKYWAY_CAMERA_NAMES[camera_id]
    official = str(location or "").strip()
    match = re.match(
        r"^(QEW|Gardiner Expressway)\s+(at|east of|west of|south of|near)\s+(.+)$",
        official,
        re.I,
    )
    if match:
        road = "QEW" if match.group(1).upper().startswith("QEW") else "Gardiner"
        place = re.sub(r"\s+\(\d+\)$", "", match.group(3)).strip()
        rel = match.group(2).lower()
        if rel in {"at", "near"}:
            return f"{road} · {place}"
        return f"{road} {rel} {place}"
    if official.startswith("QEW at ") or official.startswith("QEW East of ") or official.startswith("QEW West of "):
        return official
    return official or "QEW camera"


def camera_name(location: str, view_id: int, camera_id: int, direction: str) -> str:
    return official_name(location, view_id, camera_id)


def view_name(direction: str, location: str) -> str:
    if direction:
        return f"{direction} view" if "side" not in direction.lower() and direction != "Overhead" else direction
    return location


def main() -> int:
    payload = request_json(CAMERA_URL)
    cameras = payload if isinstance(payload, list) else payload.get("cameras") or []
    rows = []
    for camera in cameras:
        try:
            camera_id = int(camera.get("Id") or camera.get("ID"))
        except (TypeError, ValueError):
            continue
        if camera_id not in CORRIDOR_IDS:
            continue
        location = str(camera.get("Location") or "").strip()
        roadway = str(camera.get("Roadway") or "QEW").strip()
        try:
            lat = float(camera.get("Latitude"))
            lon = float(camera.get("Longitude"))
        except (TypeError, ValueError):
            continue
        landmark = nearest_landmark(lat, lon, location)
        road = nearest_road(location) or (landmark["name"] if landmark else "")
        municipality = municipality_for(lat, lon, location) or (landmark["municipality"] if landmark else "")
        views = camera.get("Views") or []
        if not views:
            continue
        group = "primary" if camera_id in PRIMARY_IDS else "corridor"
        for view in views:
            try:
                view_id = int(view.get("Id") or view.get("ID"))
            except (TypeError, ValueError):
                continue
            description = str(view.get("Description") or "").strip()
            direction = direction_from_view(description, location)
            name = camera_name(location, view_id, camera_id, direction)
            shown = display_name(location, view_id, camera_id)
            if name.lower() == "guelph" or name.lower().endswith(" at guelph"):
                name = "QEW at Guelph Line"
                shown = "QEW · Guelph Line"
            rows.append({
                "cameraId": camera_id,
                "viewId": view_id,
                "cameraName": name,
                "officialName": name,
                "displayName": shown,
                "viewName": view_name(direction, name),
                "roadway": roadway if roadway.upper() != "QEW" else "QEW",
                "nearestRoad": road if road.lower() != "guelph" else "Guelph Line",
                "municipality": municipality,
                "direction": direction,
                "latitude": lat,
                "longitude": lon,
                "status": str(view.get("Status") or ""),
                "group": group,
                "sourceUrl": f"https://511on.ca/map/Cctv/{view_id}",
            })
    rows.sort(key=lambda item: (-item["longitude"], item["latitude"], item["viewId"]))
    OUT.write_text(json.dumps({
        "updated": __import__("datetime").date.today().isoformat(),
        "source": CAMERA_URL,
        "licence": "Open Government Licence - Ontario",
        "attribution": "Camera images and locations © King's Printer for Ontario.",
        "note": "Names come from official Ontario 511 Location and view Description fields. View IDs are live image endpoints; camera IDs are physical cameras.",
        "cameras": rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} camera views from {len({row['cameraId'] for row in rows})} cameras")
    bad = [row["cameraName"] for row in rows if row["cameraName"].strip().lower() == "guelph"]
    if bad:
        raise SystemExit("Refusing to publish a camera named Guelph")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
