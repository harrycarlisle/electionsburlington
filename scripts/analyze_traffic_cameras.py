#!/usr/bin/env python3
"""Optional scheduled camera-image analysis. Never invents a pixel heuristic."""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
CAMERAS = ROOT / "data" / "traffic-cameras.json"
OUT = ROOT / "data" / "traffic-estimates.json"
TZ = ZoneInfo("America/Toronto")
USER_AGENT = "BurlingtonNews/2.2 (+https://burlingtonnews.ca/)"


def load_cameras():
    if not CAMERAS.exists():
        return []
    return json.loads(CAMERAS.read_text(encoding="utf-8")).get("cameras") or []


def request_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/*,*/*"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read()


def analyze_openai(image_url: str, key: str) -> dict | None:
    payload = {
        "model": os.environ.get("OPENAI_VISION_MODEL", "gpt-4o-mini"),
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": "Classify roadway traffic density only. Never identify people, faces, plates or drivers. Return JSON with keys traffic (light|moderate|heavy), confidence (0-1), visible_vehicles (integer estimate), notes (short).",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Estimate traffic density on this roadway camera image."},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        data = json.loads(response.read().decode("utf-8", errors="replace"))
    text = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    parsed = json.loads(text)
    traffic = str(parsed.get("traffic") or "").strip().lower()
    if traffic not in {"light", "moderate", "heavy"}:
        return None
    try:
        confidence = float(parsed.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0
    try:
        vehicles = int(parsed.get("visible_vehicles") or 0)
    except (TypeError, ValueError):
        vehicles = 0
    return {
        "traffic": traffic,
        "confidence": max(0.0, min(1.0, confidence)),
        "visible_vehicles": max(0, vehicles),
        "notes": str(parsed.get("notes") or "")[:160],
    }


def main() -> int:
    now = dt.datetime.now(TZ)
    key = (os.environ.get("OPENAI_API_KEY") or os.environ.get("TRAFFIC_VISION_KEY") or "").strip()
    cameras = [row for row in load_cameras() if row.get("group") == "primary"][:12]
    if not key:
        OUT.write_text(json.dumps({
            "generatedAt": now.isoformat(),
            "source": "none",
            "note": "No vision API key configured. Homepage and traffic page will not pretend a browser pixel heuristic is authoritative.",
            "cameras": [],
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("No vision API key; wrote empty traffic estimates")
        return 0
    results = []
    for camera in cameras:
        view_id = camera.get("viewId")
        url = f"https://511on.ca/map/Cctv/{view_id}"
        try:
            request_bytes(url)
            estimate = analyze_openai(url, key)
        except Exception as exc:
            print(f"estimate skipped for {view_id}: {type(exc).__name__}: {exc}")
            continue
        if not estimate:
            continue
        results.append({
            "cameraId": camera.get("cameraId"),
            "viewId": view_id,
            "cameraName": camera.get("cameraName"),
            "timestamp": now.isoformat(),
            **estimate,
        })
    OUT.write_text(json.dumps({
        "generatedAt": now.isoformat(),
        "source": "openai-vision",
        "note": "Estimates only. Do not identify people, plates or drivers.",
        "cameras": results,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(results)} camera estimates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
