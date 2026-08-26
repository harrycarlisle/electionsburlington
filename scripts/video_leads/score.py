from __future__ import annotations

import datetime as dt
import math
import re
from collections import defaultdict

from .match import alias_hit, hay_for_score

REGION_RANK = {
    "burlington": 5.0,
    "halton": 4.4,
    "hamilton": 3.8,
    "oakville": 3.8,
    "gta": 3.2,
    "toronto": 3.2,
    "ontario": 2.4,
    "canada": 1.6,
}

LOCAL_TERMS = (
    "burlington", "halton", "oakville", "aldershot", "appleby", "spencer smith",
    "lasalle park", "skyway", "qew", "rbg", "royal botanical", "brant street",
)
NEAR_TERMS = (
    "hamilton", "oakville", "milton", "waterdown", "stoney creek", "dundas",
)
GTA_TERMS = (
    "toronto", "union station", "cn tower", "rogers centre", "path", "gardiner",
    "ttc", "pearson", "ontario place", "cne", "blue jays", "metrolinx", "go train",
    "go transit",
)
RELEVANCE_REASONS = (
    ("burlington residents commonly use/travel there", ("union station", "go transit", "go train", "qew", "skyway", "pearson", "rogers centre", "cn tower", "path", "ontario place")),
    ("affects Burlington transportation", ("qew", "skyway", "go transit", "go train", "metrolinx", "gardiner", "401")),
    ("applies through Ontario law/policy", ("ontario", "bill ", "statute", "metrolinx", "greenbelt")),
    ("infrastructure/system directly connected to Burlington", ("go transit", "go train", "qew", "skyway", "lakeshore west", "halton")),
    ("nearby major event residents realistically attend", ("blue jays", "cne", "ontario place", "rogers centre", "harbourfront")),
    ("unusually interesting story with very broad appeal", ("how does", "why did", "hidden", "abandoned", "never built")),
)


def parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def age_hours(video: dict, now: dt.datetime | None = None) -> float:
    published = parse_time(video.get("publishedAt"))
    now = now or dt.datetime.now(dt.timezone.utc)
    if not published:
        return 24.0
    if published.tzinfo is None:
        published = published.replace(tzinfo=dt.timezone.utc)
    return max(1 / 12, (now - published).total_seconds() / 3600)


def views_per_hour(video: dict, now: dt.datetime | None = None) -> float:
    hours = max(2.0, age_hours(video, now))
    views = float(video.get("views") or 0)
    return views / hours


def channel_baselines(videos: list[dict], now: dt.datetime | None = None) -> dict[str, float]:
    buckets: dict[str, list[float]] = defaultdict(list)
    for video in videos:
        key = video.get("channelId") or video.get("channel") or ""
        buckets[key].append(views_per_hour(video, now))
    baselines = {}
    for key, values in buckets.items():
        values = sorted(values)
        mid = values[len(values) // 2] if values else 1.0
        baselines[key] = max(1.0, mid)
    return baselines


def velocity_score(video: dict, baseline: float = 1.0, now: dt.datetime | None = None) -> float:
    vph = views_per_hour(video, now)
    anomaly = vph / max(baseline, 1.0)
    likes = float(video.get("likes") or 0)
    views = max(1.0, float(video.get("views") or 0))
    engagement = min(1.0, likes / views * 20)
    raw = math.log10(1 + vph) / 4.5 + min(1.5, math.log10(1 + anomaly)) * 0.35 + engagement * 0.25
    return max(0.0, min(5.0, raw * 2.2))


def detect_region(video: dict) -> str:
    text = hay_for_score(video)
    if any(term in text for term in LOCAL_TERMS):
        if "hamilton" in text and "lasalle" in text:
            return "burlington"
        return "burlington" if "burlington" in text else "halton"
    if "oakville" in text:
        return "oakville"
    if "hamilton" in text:
        return "hamilton"
    if any(term in text for term in GTA_TERMS):
        return "toronto"
    if "ontario" in text:
        return "ontario"
    watch = str(video.get("watchlistRegion") or "")
    if watch in REGION_RANK:
        return watch
    return "canada"


def local_relevance(video: dict) -> tuple[float, list[str]]:
    region = detect_region(video)
    score = REGION_RANK.get(region, 1.4)
    reasons = []
    text = hay_for_score(video)
    for label, terms in RELEVANCE_REASONS:
        if any(alias_hit(text, term) for term in terms):
            reasons.append(label)
            score += 0.25
    if region in {"ontario", "canada"} and not reasons:
        score -= 0.8
    return max(0.0, min(5.0, score)), reasons[:3]


def novelty_score(video: dict) -> float:
    text = hay_for_score(video)
    score = 3.0
    if any(term in text for term in ("abandoned", "never built", "almost", "why ", "how ", "hidden", "forgot", "secret tunnel", "inside")):
        score += 1.0
    if any(term in text for term in ("highlights", "recap", "press conference", "game day", "vlog", "day in my life")):
        score -= 1.4
    if video.get("watchlistTopics") and "news" in video.get("watchlistTopics", []):
        score -= 0.4
    return max(0.0, min(5.0, score))


def broad_appeal(video: dict) -> float:
    text = hay_for_score(video)
    score = 2.6
    if any(term in text for term in ("why", "how", "inside", "hotel", "tower", "path", "qew", "go station", "abandoned")):
        score += 1.2
    if any(term in text for term in ("council", "ward", "bylaw", "zoning amendment")):
        score -= 0.3
    if any(term in text for term in LOCAL_TERMS + GTA_TERMS):
        score += 0.6
    return max(0.0, min(5.0, score))


def article_potential(video: dict) -> float:
    text = hay_for_score(video)
    if _low_potential(text):
        return 1.1
    score = 2.4
    if any(term in text for term in ("why", "how", "what happened", "who owns", "never")):
        score += 1.3
    if any(term in text for term in ("hotel", "stadium", "path", "tower", "qew", "go ", "abandoned", "tunnel", "park")):
        score += 1.0
    if any(term in text for term in ("official", "city of", "metrolinx", "ontario", "records", "history")):
        score += 0.4
    return max(0.0, min(5.0, score))


def source_quality(video: dict) -> float:
    name = f"{video.get('channel') or ''} {' '.join(video.get('watchlistTopics') or [])}".lower()
    if any(term in name for term in ("city of", "metrolinx", "police", "parks canada", "historica", "tvo", "conservation")):
        return 4.6
    if any(term in name for term in ("cbc", "ctv", "global", "cp24", "citynews")):
        return 3.8
    if video.get("discoverySource") == "youtube_data_api":
        return 3.4
    return 3.2


def _low_potential(text: str) -> bool:
    return bool(re.search(
        r"\b(vlog|day in my life|unboxing|reaction|challenge|mukbang|haunted house tour|i stayed|i visited|youtuber visits|popular youtuber|global national|front burner|dolly parton|ivf|celebrity|press conference|highlights)\b",
        text,
    ))


def score_video(video: dict, baseline: float = 1.0, now: dt.datetime | None = None, weights: dict | None = None) -> dict:
    weights = weights or {
        "localRelevance": 0.25, "velocity": 0.20, "novelty": 0.15,
        "broadAppeal": 0.15, "articlePotential": 0.15, "sourceQuality": 0.10,
    }
    relevance, reasons = local_relevance(video)
    parts = {
        "localRelevance": relevance,
        "velocity": velocity_score(video, baseline, now),
        "novelty": novelty_score(video),
        "broadAppeal": broad_appeal(video),
        "articlePotential": article_potential(video),
        "sourceQuality": source_quality(video),
    }
    overall = sum(parts[key] * float(weights[key]) for key in parts)
    region = detect_region(video)
    if region in {"ontario", "canada"} and relevance < 2.4 and parts["broadAppeal"] < 3.4:
        overall *= 0.72
    return {
        **parts,
        "overall": round(overall, 3),
        "region": region,
        "relevanceReasons": reasons,
        "viewsPerHour": round(views_per_hour(video, now), 2),
        "channelBaseline": round(baseline, 2),
    }
