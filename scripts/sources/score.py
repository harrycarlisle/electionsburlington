"""Breaking-worthiness scoring. Newest is not enough."""

from __future__ import annotations

import datetime as dt
from typing import Any
from zoneinfo import ZoneInfo

from editorial_policy import load_policy

from .relevance import burlington_relevance, hay

TZ = ZoneInfo("America/Toronto")

DEFAULT_WEIGHTS = {
    "localRelevance": 0.25,
    "impact": 0.25,
    "recency": 0.20,
    "confidence": 0.15,
    "breadth": 0.10,
    "novelty": 0.05,
}

HIGH_IMPACT = (
    "closure", "closed", "suspend", "cancelled", "evacuat", "tornado",
    "collision", "crash", "fire", "outage", "spill", "flood", "shooting",
    "missing", "amber", "explosion", "hazmat", "data centre", "data center",
    "property tax", "tax increase", "budget", "election result", "advance voting",
)
MEDIUM_IMPACT = (
    "proposal", "council", "development", "construction",
    "investigation", "delay", "cops", "police",
)
POLICE_HIGH = (
    "responding", "close", "closed", "collision", "emergency",
    "activity", "investigation",
)
LOW_IMPACT = (
    "press release", "now hiring", "looking for temporary", "subscribe",
    "photo", "congratulations", "lunch special",
)


def parse_time(value: Any) -> dt.datetime | None:
    if not value:
        return None
    if isinstance(value, dt.datetime):
        return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def recency_score(published_at: Any, now: dt.datetime | None = None, ongoing: bool = False) -> float:
    """Suggested bands: <30m very high; 6–12h rarely Breaking Now."""
    now = now or dt.datetime.now(TZ)
    parsed = parse_time(published_at)
    if not parsed:
        return 1.6 if ongoing else 0.8
    hours = max(0.0, (now - parsed.astimezone(now.tzinfo or TZ)).total_seconds() / 3600)
    if hours < 0.5:
        return 5.0
    if hours < 1.5:
        return 4.3
    if hours < 3:
        return 3.5
    if hours < 6:
        return 2.5
    if hours < 12:
        return 1.3 if not ongoing else 3.2
    return 3.0 if ongoing else 0.4


def impact_score(item: dict[str, Any]) -> float:
    text = hay(item)
    if any(term in text for term in LOW_IMPACT):
        return 1.4
    if "police" in text and any(term in text for term in POLICE_HIGH):
        return 4.5
    if any(term in text for term in HIGH_IMPACT):
        score = 4.4
        if re_search_any(text, ("suspend", "evacuat", "tornado", "all lanes", "complete closure", "closed")):
            score = 4.9
        return score
    if any(term in text for term in MEDIUM_IMPACT):
        return 3.1
    return float(item.get("impactScore") or 2.2)


def re_search_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def confidence_score(item: dict[str, Any]) -> float:
    if item.get("confidenceScore") is not None:
        return float(item["confidenceScore"])
    source_type = str(item.get("sourceType") or "").lower()
    status = str(item.get("verificationStatus") or "").lower()
    if source_type in {"official", "primary", "official_social"} or status in {"verified", "official"}:
        return 5.0
    if source_type in {"reporting", "newsroom"} or status in {"corroborated", "reported"}:
        return 4.0
    if source_type in {"community", "social"} or status in {"community_lead", "unverified"}:
        return 2.0 if "official" not in status else 3.0
    return 3.0


def novelty_score(item: dict[str, Any]) -> float:
    text = hay(item)
    if any(term in text for term in ("update", "reminder", "now hiring", "weekly")):
        return 1.8
    return float(item.get("noveltyScore") or 3.4)


def breadth_score(item: dict[str, Any]) -> float:
    text = hay(item)
    if any(term in text for term in ("qew", "lakeshore west", "skyway", "city-wide", "burlington")):
        return 4.2
    return float(item.get("breadthScore") or 2.8)


def public_need_score(item: dict[str, Any]) -> float:
    return max(impact_score(item), float(item.get("publicNeedScore") or 0))


def _weights() -> dict[str, float]:
    policy = load_policy()
    block = policy.get("breakingNow") or {}
    return dict(block.get("weights") or DEFAULT_WEIGHTS)


def breaking_score(item: dict[str, Any], now: dt.datetime | None = None) -> dict[str, Any]:
    now = now or dt.datetime.now(TZ)
    ongoing = str(item.get("status") or "").lower() in {"ongoing", "active"}
    recency = recency_score(item.get("updatedAt") or item.get("publishedAt"), now, ongoing)
    local = float(item.get("localRelevance") or burlington_relevance(item))
    impact = impact_score(item)
    confidence = confidence_score(item)
    breadth = breadth_score(item)
    novelty = novelty_score(item)
    need = public_need_score(item)
    weights = _weights()
    score = (
        local * weights.get("localRelevance", 0.25)
        + impact * weights.get("impact", 0.25)
        + recency * weights.get("recency", 0.20)
        + confidence * weights.get("confidence", 0.15)
        + breadth * weights.get("breadth", 0.10)
        + novelty * weights.get("novelty", 0.05)
    )
    item["localRelevance"] = round(local, 2)
    item["impactScore"] = round(impact, 2)
    item["recencyScore"] = round(recency, 2)
    item["confidenceScore"] = round(confidence, 2)
    item["breadthScore"] = round(breadth, 2)
    item["noveltyScore"] = round(novelty, 2)
    item["publicNeedScore"] = round(need, 2)
    item["breakingScore"] = round(score, 3)
    return item


def passes_breaking_threshold(item: dict[str, Any], now: dt.datetime | None = None) -> tuple[bool, str]:
    """Ordinary bar: confidence >= 4 and strong impact. Community leads stay out unless labelled and exceptional."""
    scored = breaking_score(dict(item), now)
    policy = load_policy().get("breakingNow") or {}
    min_score = float(policy.get("minScore") or 3.45)
    min_conf = float(policy.get("minConfidence") or 4.0)
    community_min = float(policy.get("communityMinConfidence") or 2.0)
    confidence = float(scored.get("confidenceScore") or 0)
    impact = float(scored.get("impactScore") or 0)
    recency = float(scored.get("recencyScore") or 0)
    local = float(scored.get("localRelevance") or 0)
    status = str(scored.get("verificationStatus") or "").lower()
    label = str(scored.get("label") or "").upper()

    if impact < 2.8:
        return False, "low-impact"
    if local < 2.4 and impact < 4.7:
        return False, "not-burlington-enough"
    if recency < 1.2 and str(scored.get("status") or "").lower() not in {"ongoing", "active"}:
        return False, "stale"
    if confidence >= min_conf and scored["breakingScore"] >= min_score and impact >= 3.4:
        return True, "verified-high"
    if (
        community_min <= confidence < min_conf
        and impact >= 4.4
        and recency >= 4.0
        and local >= 4.0
        and label in {"COMMUNITY REPORT", "UNVERIFIED"}
        and status in {"community_lead", "unverified", "unverified_community_report"}
    ):
        return True, "labelled-community-exception"
    if confidence < min_conf:
        return False, "confidence-too-low"
    return False, "below-threshold"
