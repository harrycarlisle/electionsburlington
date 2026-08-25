#!/usr/bin/env python3
"""Build a daily original-story candidate list.

Radar should not only react to other publishers. This pass asks: what unusually
interesting Burlington story could we make ourselves today? It ranks unpublished
pitches against archives, public discussion and already-published originals.
It does not write finished features.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from editorial_policy import load_policy

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "original-candidates.json"
TZ = ZoneInfo("America/Toronto")


def load(name: str, fallback):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def score_pitch(pitch: dict, catalog_ids: set[str], community: dict) -> int:
    status = str(pitch.get("status") or "").lower()
    score = 58
    if status in {"priority-reporting", "reporting"}:
        score += 14
    elif status in {"research", "open-research"}:
        score += 8
    elif status in {"format-development", "hold-for-archive-access"}:
        score += 4
    if pitch.get("hook"):
        score += 6
    if pitch.get("sourceLeads"):
        score += 5
    if pitch.get("reportingNeeded"):
        score += min(6, len(pitch["reportingNeeded"]))
    if pitch.get("publishGate"):
        score += 3
    hay = " ".join(str(pitch.get(key) or "") for key in ("workingTitle", "hook", "slug")).lower()
    if any(token in hay for token in ("burlington", "skyway", "brant", "nostalgia", "golf", "0-24", "crime", "cafe")):
        score += 4
    title = (community.get("item") or {}).get("title") or community.get("headline") or ""
    if title and any(word in hay for word in str(title).lower().split() if len(word) > 4):
        score += 5
    if pitch.get("slug") in catalog_ids or status == "published":
        score = 0
    return min(98, score)


def main() -> int:
    policy = load_policy()
    rules = policy.get("originalStory") or {}
    excluded = {str(item).lower() for item in rules.get("excludeStatuses") or ("published", "hold-duplicate")}
    pitches = load("editorial-pitches.json", {}).get("pitches") or []
    catalog = load("story-catalog.json", {})
    catalog_ids = {item.get("id") for item in catalog.get("items") or []}
    catalog_urls = {str(item.get("url") or "") for item in catalog.get("items") or []}
    community = load("community-pulse.json", {})
    archive = load("editorial-archive.json", {})
    now = dt.datetime.now(TZ)

    candidates = []
    for pitch in pitches:
        status = str(pitch.get("status") or "").lower()
        if status in excluded:
            continue
        if pitch.get("url") and pitch["url"] in catalog_urls:
            continue
        ranked = {
            "id": pitch.get("slug"),
            "kind": "original-candidate",
            "headline": pitch.get("workingTitle"),
            "hook": pitch.get("hook"),
            "status": pitch.get("status"),
            "reportingNeeded": pitch.get("reportingNeeded") or [],
            "publishGate": pitch.get("publishGate") or "Do not publish until the reporting checklist and evidence gates pass.",
            "sourceLeads": pitch.get("sourceLeads") or [],
            "researchNotes": pitch.get("researchNotes"),
            "origin": "editorial-pitch",
            "autoPublishReady": False,
            "eligibility": ["editorial queue"],
            "candidateScore": score_pitch(pitch, catalog_ids, community),
        }
        candidates.append(ranked)

    candidates.sort(key=lambda item: item["candidateScore"], reverse=True)
    minimum = int(rules.get("minimumCandidates") or 1)
    selected = [item for item in candidates if item["candidateScore"] >= 50][: max(minimum, 3)]
    if not selected and candidates:
        selected = candidates[:minimum]

    payload = {
        "generatedAt": now.isoformat(),
        "method": "Rank unpublished original pitches for curiosity, local specificity, available reporting leads and archive potential. Do not invent finished features.",
        "cadence": rules.get("cadence"),
        "today": selected[:1],
        "candidates": selected,
        "held": [
            {
                "id": pitch.get("slug"),
                "headline": pitch.get("workingTitle"),
                "status": pitch.get("status"),
                "reason": "Held by editorial status or already published.",
            }
            for pitch in pitches
            if str(pitch.get("status") or "").lower() in excluded
        ],
        "archiveHint": archive.get("note") or "Use public archives, civic records and league/club data; do not mirror another publisher.",
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Selected {len(payload['today'])} original-story candidate(s) from {len(candidates)} eligible pitches")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
