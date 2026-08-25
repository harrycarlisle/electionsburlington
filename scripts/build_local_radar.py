#!/usr/bin/env python3
"""Build a normalized Burlington News local radar from existing monitored feeds.

The radar is deliberately source-agnostic. Official feeds, reporting, community
signals and Burlington News originals compete on reader value rather than source
position. Straight aggregation and repeated exposure are penalized.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import re
from pathlib import Path
from zoneinfo import ZoneInfo

from editorial_policy import load_policy, signal_weights

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TZ = ZoneInfo("America/Toronto")
OUT = DATA / "local-radar.json"
SEEN = DATA / "radar-seen.json"
NAV_JUNK = (
    "privacy policy", "terms of use", "terms of service", "contact us", "sign in",
    "log in", "subscribe", "skip to", "cookie", "accessibility statement",
    "health & well-being", "health and well-being", "main menu", "search the site",
)

SOURCE_CONFIDENCE = {"official": 5.0, "primary": 5.0, "reporting": 4.0, "reported": 4.0, "community": 2.0, "social": 1.5}
HIGH_INTEREST = ("crash", "collision", "fire", "crime", "police", "rabies", "school", "tax", "closure", "flood", "outage", "election", "restaurant", "food", "golf", "record", "winless", "0-24", "skyway", "go transit", "housing")
HIGH_CONSEQUENCE = ("collision", "closure", "outage", "evac", "fire", "rabies", "crime", "police", "tax", "budget", "election", "road closed", "train", "school", "health")
BURLINGTON_TERMS = ("burlington", "brant street", "guelph line", "walkers line", "appleby line", "aldershot", "plains road", "spencer smith", "millcroft", "mount nemo", "lowville", "skyway", "burloak")
NEARBY_TERMS = ("oakville", "halton", "hamilton", "waterdown", "milton", "qew", "lakeshore west", "royal botanical gardens")
CANADA_TERMS = ("canada", "canadian", "ontario", "tariff", "federal", "bank of canada")


def load(name: str, fallback):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def clamp(value: float, low: float = 0.0, high: float = 5.0) -> float:
    return max(low, min(high, value))


def text(item: dict) -> str:
    return " ".join(str(item.get(key) or "") for key in ("headline", "title", "description", "why", "location", "tag", "scope")).lower()


def locality_score(item: dict) -> float:
    hay = text(item)
    if any(term in hay for term in BURLINGTON_TERMS):
        return 5.0
    if any(term in hay for term in NEARBY_TERMS):
        return 3.4
    if any(term in hay for term in CANADA_TERMS):
        return 2.0
    scope = str(item.get("scope") or "").lower()
    if scope in {"city", "burlington"}:
        return 5.0
    if scope in {"region", "halton", "transit"}:
        return 3.4
    return 1.2


def freshness_score(item: dict, now: dt.datetime) -> float:
    stamp = iso(item.get("detectedAt") or item.get("published") or item.get("checkedAt") or item.get("lastUpdatedAt"))
    if not stamp:
        return 2.4
    hours = max(0.0, (now.astimezone(dt.timezone.utc) - stamp.astimezone(dt.timezone.utc)).total_seconds() / 3600)
    if hours <= 1:
        return 5.0
    if hours <= 3:
        return 4.6
    if hours <= 6:
        return 4.0
    if hours <= 12:
        return 3.2
    if hours <= 24:
        return 2.4
    if hours <= 72:
        return 1.5
    return 0.7


def keyword_score(item: dict, terms: tuple[str, ...], base: float = 2.2) -> float:
    hay = text(item)
    matches = sum(1 for term in terms if term in hay)
    return clamp(base + matches * 0.8)


def originality_score(item: dict) -> float:
    source = str(item.get("source") or item.get("sourceName") or "").lower()
    if item.get("kind") == "original" or source == "burlington news":
        return 5.0
    if "burlingtontoday" in source:
        return 1.5
    if item.get("sourceType") in {"official", "primary"}:
        return 4.6
    if item.get("sourceType") in {"reporting", "reported"}:
        return 3.3
    return 2.6


def confidence_score(item: dict) -> float:
    tier = str(item.get("verificationTier") or item.get("sourceType") or "").lower()
    if tier in SOURCE_CONFIDENCE:
        return SOURCE_CONFIDENCE[tier]
    source = str(item.get("source") or "").lower()
    if any(token in source for token in ("ontario 511", "city of burlington", "halton region", "metrolinx")):
        return 5.0
    return 2.8


def visual_score(item: dict) -> float:
    return 5.0 if item.get("image") else (4.0 if item.get("kind") in {"traffic", "event"} else 2.2)


def stable_id(item: dict) -> str:
    raw = str(item.get("id") or item.get("url") or item.get("sourceUrl") or item.get("headline") or item.get("title") or "")
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def rotation_score(item_id: str, seen: dict, now: dt.datetime) -> float:
    rec = seen.get(item_id) or {}
    shown = int(rec.get("homepageShows") or 0)
    last = iso(rec.get("lastHomepageAt"))
    if not shown or not last:
        return 5.0
    hours = max(0.0, (now.astimezone(dt.timezone.utc) - last.astimezone(dt.timezone.utc)).total_seconds() / 3600)
    recovery = min(3.0, hours / 12)
    return clamp(1.0 + recovery - min(1.8, shown * 0.25))


def normalize(item: dict, kind: str, now: dt.datetime, seen: dict) -> dict:
    candidate = dict(item)
    candidate["kind"] = kind
    candidate["headline"] = candidate.get("headline") or candidate.get("title") or "Local update"
    candidate["url"] = candidate.get("url") or candidate.get("sourceUrl") or "updates.html"
    candidate["source"] = candidate.get("source") or candidate.get("sourceName") or "Unknown"
    candidate["radarId"] = stable_id(candidate)
    signals = {
        "interest": keyword_score(candidate, HIGH_INTEREST, 2.3),
        "relevance": locality_score(candidate),
        "novelty": clamp(2.5 + (0.8 if kind in {"community", "original"} else 0) + (0.5 if re.search(r"\b\d{2,}\b", text(candidate)) else 0)),
        "familiarity": clamp(2.5 + (1.0 if any(term in text(candidate) for term in BURLINGTON_TERMS) else 0)),
        "consequence": keyword_score(candidate, HIGH_CONSEQUENCE, 2.0),
        "freshness": freshness_score(candidate, now),
        "sourceConfidence": confidence_score(candidate),
        "originality": originality_score(candidate),
        "visualStrength": visual_score(candidate),
        "rotation": rotation_score(candidate["radarId"], seen, now),
    }
    candidate["signals"] = signals
    weights = signal_weights("radar")
    score = sum(signals[key] * float(weights.get(key) or 0) for key in signals) / 5 * 100
    source_lower = candidate["source"].lower()
    if "burlingtontoday" in source_lower:
        score *= .82
        candidate["sourceIndependencePenalty"] = True
    if signals["relevance"] < 2.5 and signals["consequence"] < 4.4:
        score *= .55
    candidate["radarScore"] = round(score)
    rules = (load_policy().get("eligibility") or {})
    right_now = rules.get("rightNow") or {}
    homepage = rules.get("homepage") or {}
    candidate["eligibleRightNow"] = (
        signals["freshness"] >= float(right_now.get("minFreshness") or 3.2)
        and signals["relevance"] >= float(right_now.get("minRelevance") or 3.4)
        and signals["sourceConfidence"] >= float(right_now.get("minSourceConfidence") or 3.8)
        and signals["consequence"] >= float(right_now.get("minConsequence") or 3.0)
    )
    candidate["eligibleHomepage"] = (
        signals["relevance"] >= float(homepage.get("minRelevance") or 3.4)
        and signals["sourceConfidence"] >= float(homepage.get("minSourceConfidence") or 3.8)
        and candidate["radarScore"] >= float(homepage.get("minRadarScore") or 58)
    )
    candidate["eligibleNewest"] = signals["freshness"] >= 2.4 and signals["relevance"] >= 3.0
    candidate["eligibleEditorial"] = candidate["kind"] in {"original", "community"} or signals["novelty"] >= 3.2
    return candidate


def is_junk(item: dict) -> bool:
    headline = str(item.get("headline") or item.get("title") or "").strip().lower()
    if not headline or len(headline) < 8:
        return True
    if headline in NAV_JUNK or any(headline.startswith(token) for token in NAV_JUNK):
        return True
    if headline.count(" ") < 2 and len(headline) < 22:
        return True
    return False


def main() -> int:
    now = dt.datetime.now(TZ)
    seen_payload = load("radar-seen.json", {"items": {}})
    seen = seen_payload.get("items") or {}
    candidates: list[dict] = []

    source_monitor = load("source-monitor.json", {"items": []})
    for item in source_monitor.get("items", []):
        if item.get("verified") and not is_junk(item):
            candidates.append(normalize(item, "source", now, seen))

    local_leads = load("local-leads.json", {"items": []})
    for item in local_leads.get("items", []):
        candidates.append(normalize(item, item.get("kind") or "official", now, seen))

    community = load("community-pulse.json", {})
    if community.get("item"):
        item = dict(community["item"])
        item.setdefault("source", "Burlington community discussion")
        item.setdefault("sourceType", "community")
        item.setdefault("checkedAt", community.get("checkedAt"))
        candidates.append(normalize(item, "community", now, seen))

    catalog = load("story-catalog.json", {"items": []})
    for item in catalog.get("items", []):
        published = dict(item)
        published.setdefault("source", "Burlington News")
        published.setdefault("sourceType", "official" if item.get("gates", {}).get("evidence") == "passed" else "reporting")
        published.setdefault("verificationTier", "reported")
        published.setdefault("kind", "original")
        candidates.append(normalize(published, "original", now, seen))

    pitches = load("editorial-pitches.json", {}).get("pitches") or []
    excluded = {str(item).lower() for item in (load_policy().get("originalStory") or {}).get("excludeStatuses") or ("published", "hold-duplicate")}
    for pitch in pitches:
        if str(pitch.get("status") or "").lower() in excluded:
            continue
        idea = {
            "id": f"pitch:{pitch.get('slug')}",
            "headline": pitch.get("workingTitle"),
            "description": pitch.get("hook"),
            "source": "Burlington News",
            "sourceType": "official",
            "kind": "original",
            "url": "docs/editorial-style.md",
            "verificationTier": "reported",
        }
        if not is_junk(idea):
            candidates.append(normalize(idea, "original", now, seen))

    # Deduplicate by normalized headline; prefer the higher scoring / more primary version.
    deduped: dict[str, dict] = {}
    for item in candidates:
        key = re.sub(r"[^a-z0-9]+", " ", item["headline"].lower()).strip()
        current = deduped.get(key)
        if current is None or item["radarScore"] > current["radarScore"]:
            deduped[key] = item

    ranked = sorted(deduped.values(), key=lambda row: row["radarScore"], reverse=True)
    right_now = [row for row in ranked if row["eligibleRightNow"]][:5]
    homepage = [row for row in ranked if row["eligibleHomepage"]][:12]
    originals = [
        row for row in ranked
        if row["kind"] == "original" or (row["signals"]["novelty"] >= 3.1 and row["signals"]["interest"] >= 3.0)
    ][:12]

    for row in ranked:
        rec = seen.setdefault(row["radarId"], {})
        rec.setdefault("firstSeenAt", now.isoformat())
        rec["lastSeenAt"] = now.isoformat()
        rec["headline"] = row["headline"]
    # Keep state bounded.
    cutoff = now - dt.timedelta(days=90)
    seen = {key: value for key, value in seen.items() if (iso(value.get("lastSeenAt")) or now) >= cutoff}

    payload = {
        "generatedAt": now.isoformat(),
        "method": "Interest + relevance + novelty + familiarity + consequence + freshness + source confidence + originality + visual strength + rotation. BurlingtonToday is discovery/backstop, not a preferred publisher.",
        "rightNow": right_now,
        "homepage": homepage,
        "originalIdeas": originals,
        "items": ranked[:80],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SEEN.write_text(json.dumps({"updatedAt": now.isoformat(), "items": seen}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built radar with {len(ranked)} candidates; {len(right_now)} right-now eligible")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
