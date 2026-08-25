#!/usr/bin/env python3
"""Build a daily Burlington News editorial queue from verified and community inputs.

This does not treat social posts as proof. Low-risk, verified items can be marked
`autoPublishReady`; community items remain leads until corroborated.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from editorial_policy import is_low_risk, signal_weights

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("America/Toronto")
OUT = ROOT / "data" / "editorial-queue.json"
WEIGHTS = signal_weights("queue")


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
    values = {
        "interest": interest, "relevance": relevance, "novelty": novelty,
        "familiarity": familiarity, "consequence": consequence,
        "sourceConfidence": confidence, "originality": originality,
    }
    value = sum(values[key] * float(WEIGHTS.get(key) or 0) for key in values)
    return round(max(0,min(5,value))/5*100)


def low_risk(item: dict) -> bool:
    return is_low_risk(item)


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
    pulse = community.get("item") if isinstance(community.get("item"), dict) else community
    community_headline = (pulse or {}).get("title") or (pulse or {}).get("headline") or community.get("headline")
    if community_headline:
        item = {
            "headline": community_headline,
            "summary": (pulse or {}).get("summary") or community.get("summary") or (pulse or {}).get("context") or community.get("context") or "",
            "url": (pulse or {}).get("url") or community.get("url") or "",
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
    originals = load(ROOT / "data" / "original-candidates.json", {})
    for raw in originals.get("candidates") or originals.get("today") or []:
        item = dict(raw)
        item["origin"] = "original-candidate"
        item["verificationTier"] = "community"
        item["autoPublishReady"] = False
        item["summary"] = item.get("hook") or item.get("summary") or ""
        item.setdefault("storyGoal", "Report an original Burlington story that another publisher is not already defining.")
        item["editorialScore"] = score({**item, "interest": 4.6, "novelty": 4.8, "originality": 5, "relevance": 5, "familiarity": 4, "consequence": 3.4})
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
