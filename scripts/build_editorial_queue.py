#!/usr/bin/env python3
"""Build a daily Burlington News editorial queue from verified and community inputs.

This does not treat social posts as proof. Low-risk, verified items can be marked
`autoPublishReady`; community items remain leads until corroborated.
"""
from __future__ import annotations
import datetime as dt
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("America/Toronto")
OUT = ROOT / "data" / "editorial-queue.json"


def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def score(item: dict) -> int:
    interest = float(item.get("interest", item.get("importance", 3)))
    relevance = float(item.get("relevance", 5 if "burlington" in (item.get("headline", "") + item.get("summary", "")).lower() else 3))
    novelty = float(item.get("novelty", 3))
    familiarity = float(item.get("familiarity", 3))
    consequence = float(item.get("consequence", item.get("importance", 3)))
    confidence = {"primary":5,"official":5,"reported":4,"corroborated":4,"community":2,"unverified_community_report":1}.get(str(item.get("verificationTier") or item.get("verification") or "").lower(),3)
    originality = float(item.get("originality", 4 if item.get("sourceType") != "reporting" else 3))
    value = interest*.23 + relevance*.20 + novelty*.15 + familiarity*.11 + consequence*.12 + confidence*.12 + originality*.07
    return round(max(0,min(5,value))/5*100)


def low_risk(item: dict) -> bool:
    tier = str(item.get("verificationTier") or "").lower()
    text = (item.get("headline", "") + " " + item.get("summary", "")).lower()
    blocked = ("alleged", "accused", "charged", "endorse", "vote for", "fraud", "corrupt", "sexual", "murder")
    return tier in {"primary","official","reported","corroborated"} and not any(term in text for term in blocked) and bool(item.get("url"))


def main() -> int:
    brief = load(ROOT / "data" / "daily-brief.json", {"items":[]})
    community = load(ROOT / "data" / "community-pulse.json", {})
    items = []
    for raw in brief.get("items", []):
        item = dict(raw)
        item["origin"] = "daily-brief"
        item["editorialScore"] = score(item)
        item["autoPublishReady"] = low_risk(item)
        item["storyGoal"] = item.get("why") or item.get("summary")
        items.append(item)
    if community and community.get("headline"):
        item = {
            "headline": community.get("headline"),
            "summary": community.get("summary") or community.get("context") or "",
            "url": community.get("url") or "",
            "origin": "community",
            "verification": community.get("verification", "unverified_community_report"),
            "verificationTier": "community",
            "interest": 4,
            "novelty": 4,
            "familiarity": 4,
            "relevance": 5,
            "importance": 3,
            "originality": 5,
            "autoPublishReady": False,
            "storyGoal": "Verify the community lead, then explain the practical Burlington consequence."
        }
        item["editorialScore"] = score(item)
        items.append(item)
    items.sort(key=lambda x: x["editorialScore"], reverse=True)
    payload = {
        "generatedAt": dt.datetime.now(TZ).isoformat(),
        "method": "Interest + relevance + novelty + familiarity + consequence + source confidence + originality. Social leads cannot auto-publish without corroboration.",
        "publishReady": [item for item in items if item.get("autoPublishReady")][:5],
        "reportingLeads": [item for item in items if not item.get("autoPublishReady")][:8],
        "all": items[:15]
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built editorial queue with {len(payload['publishReady'])} publish-ready items and {len(payload['reportingLeads'])} leads")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
