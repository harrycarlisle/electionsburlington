#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from traffic_context import (
    cameras_along_route,
    combine_looks,
    incident_feature_label,
    incident_relevance,
    normalize_incident,
    route_drive_status,
    title_for,
)


def test_dorval_ramp():
    item = normalize_incident({
        "headline": "Continuous Construction on QEW Toronto bound On-ramp at DORVAL DRIVE, Oakville. ALL LANES CLOSED.",
        "RoadwayName": "QEW",
        "DirectionOfTravel": "Toronto-bound",
        "Latitude": 43.4462,
        "Longitude": -79.6998,
        "Location": "Dorval Drive",
    })
    assert "Dorval" in item["title"], item["title"]
    assert item["municipality"] == "Oakville"
    assert item["facility"] == "on-ramp"
    assert item["type"] == "closure"
    assert item["affectsSkyway"] is False
    assert "Toronto" in item["impact"]


def test_skyway_collision():
    item = normalize_incident({
        "headline": "Collision on the Burlington Skyway Toronto bound",
        "RoadwayName": "QEW",
        "Latitude": 43.3025,
        "Longitude": -79.7995,
    })
    assert item["affectsSkyway"] is True
    assert item["type"] == "collision"


def test_no_guelph_chop():
    title = title_for("construction", "QEW", "Toronto-bound", "Guelph Line", "mainline")
    assert "Guelph Line" in title
    assert title != "Construction on QEW near Guelph"


def test_route_order():
    line = [
        [43.3255, -79.7990],
        [43.3413, -79.8220],
        [43.3510, -79.8044],
        [43.3660, -79.7878],
        [43.4462, -79.6998],
    ]
    cameras = [
        {"cameraName": "QEW at Walkers Line", "latitude": 43.3660, "longitude": -79.7878},
        {"cameraName": "QEW at Guelph Line", "latitude": 43.35099, "longitude": -79.80439},
        {"cameraName": "QEW at Brant Street", "latitude": 43.3413, "longitude": -79.8220},
        {"cameraName": "Far away", "latitude": 43.89, "longitude": -78.86},
        {"cameraName": "Off corridor", "latitude": 43.30, "longitude": -79.90},
    ]
    matched = cameras_along_route(cameras, line)
    names = [item["cameraName"] for item in matched]
    assert names == ["QEW at Brant Street", "QEW at Guelph Line", "QEW at Walkers Line"], names
    assert "Guelph" not in {name.replace("Guelph Line", "") for name in names}


def test_far_incident_does_not_steal_centennial():
    item = normalize_incident({
        "headline": "Nightly Construction on QEW Fort Erie Bound Off-ramp at CHRISTIE ST / LAKEVIEW AVE, Grimsby. ALL LANES CLOSED.",
        "RoadwayName": "QEW",
        "Latitude": 43.19871,
        "Longitude": -79.56138,
    })
    assert "Centennial" not in item["title"], item["title"]
    assert "Christie" in item["nearestRoad"], item["nearestRoad"]
    assert item["municipality"] == "Grimsby"


def test_combine():
    assert combine_looks(["light", "light", "moderate"]) == "moderate"
    assert combine_looks(["light", "light", "light"]) == "light"
    assert combine_looks([]) == ""


def test_route_drive_status_separates_ramps():
    dorval = normalize_incident({
        "headline": "Continuous Construction on QEW Toronto bound On-ramp at DORVAL DRIVE, Oakville. ALL LANES CLOSED.",
        "RoadwayName": "QEW",
        "DirectionOfTravel": "Toronto-bound",
        "Latitude": 43.4462,
        "Longitude": -79.6998,
        "Location": "Dorval Drive",
    })
    assert incident_relevance(dorval, "toronto") == "local"
    assert incident_relevance(dorval, "niagara-falls") == "opposite"
    status = route_drive_status([dorval], "toronto")
    assert status["headline"] == "Moving well"
    assert "on-ramp closed" in status["detail"]
    assert status["impact"] == "Local access affected"
    assert "Dorval" in incident_feature_label(dorval)

    christie = normalize_incident({
        "headline": "Nightly Construction on QEW Fort Erie Bound Off-ramp at CHRISTIE ST / LAKEVIEW AVE, Grimsby. ALL LANES CLOSED.",
        "RoadwayName": "QEW",
        "Latitude": 43.19871,
        "Longitude": -79.56138,
    })
    west = route_drive_status([christie], "niagara-falls")
    assert west["headline"] == "Moving well"
    assert "off-ramp" in west["detail"]
    assert route_drive_status([christie], "toronto")["detail"] == ""

    skyway = normalize_incident({
        "headline": "Collision on the Burlington Skyway Toronto bound",
        "RoadwayName": "QEW",
        "Latitude": 43.3025,
        "Longitude": -79.7995,
    })
    hit = route_drive_status([skyway], "toronto")
    assert "slowing" in hit["headline"].lower() or "heavy" in hit["headline"].lower()
    assert hit["impact"] == "Likely affecting traffic"


if __name__ == "__main__":
    test_dorval_ramp()
    test_skyway_collision()
    test_no_guelph_chop()
    test_route_order()
    test_far_incident_does_not_steal_centennial()
    test_combine()
    test_route_drive_status_separates_ramps()
    print("traffic_context tests passed")
