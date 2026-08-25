#!/usr/bin/env python3
"""Rank public Burlington discussion without treating social posts as evidence.

The homepage publishes one conversation signal, never a poll or news fact. Fresh,
high-impact local reports can outrank older high-engagement discussion, but remain
explicitly unverified until corroborated elsewhere.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import pathlib
import re
import urllib.request

UTC = dt.timezone.utc
USER_AGENT = "BurlingtonNewsCommunitySignal/1.1 (+https://burlingtonnews.ca/methodology.html#community-signal)"
FEEDS = (
    "https://www.reddit.com/r/BurlingtonON/hot.json?raw_json=1&limit=75",
    "https://www.reddit.com/r/BurlingtonON/new.json?raw_json=1&limit=75",
)
LOCAL_TERMS = {
    "burlington", "aldershot", "alton", "brant", "burloak", "downtown",
    "headon", "tyandaga", "orchard", "roseland", "tansley", "appleby",
    "guelph line", "new street", "lakeshore", "skyway", "beachway",
    "spencer smith", "mount nemo", "kerncliff", "lasalle", "rbg", "qew",
    "burlington go", "bayhawks", "burlington blast", "ribfest", "city council", "ward",
}
IMPACT_TERMS = {
    "collision": 20, "crash": 20, "accident": 18, "fire": 20, "closure": 18,
    "closed": 16, "blocked": 16, "outage": 18, "police": 12, "ambulance": 12,
    "emergency": 18, "delay": 14, "delays": 14, "cancelled": 14, "flood": 20,
    "flooding": 20, "storm": 15, "power": 10, "traffic": 10,
}
BLOCKED = re.compile(r"\b(buy|sell|for sale|promo code|referral|onlyfans|escort|hookup)\b", re.I)


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def hours_old(created: float, now: dt.datetime) -> float:
    return max(0.0, (now - dt.datetime.fromtimestamp(created, UTC)).total_seconds() / 3600)


def local_relevance(text: str) -> tuple[float, list[str]]:
    lower = text.lower()
    matches = sorted(term for term in LOCAL_TERMS if term in lower)
    return min(24.0, 10.0 + len(matches) * 3.0), matches[:5]


def impact_score(text: str, age: float) -> tuple[float, list[str]]:
    lower = text.lower()
    matched = sorted(term for term in IMPACT_TERMS if re.search(rf"\b{re.escape(term)}\b", lower))
    if not matched:
        return 0.0, []
    base = min(25.0, max(IMPACT_TERMS[term] for term in matched) + min(5, len(matched) - 1) * 2)
    # Breaking utility decays quickly: a 2-hour collision matters more than a 20-hour thread.
    decay = math.exp(-age / 8.0)
    return round(base * decay, 1), matched[:4]


def score_post(post: dict, now: dt.datetime) -> tuple[float, dict] | None:
    title = re.sub(r"\s+", " ", str(post.get("title") or "")).strip()
    body = str(post.get("selftext") or "")
    if not (10 <= len(title) <= 180) or BLOCKED.search(title):
        return None
    if post.get("stickied") or post.get("over_18") or post.get("removed_by_category"):
        return None
    if str(post.get("author") or "").lower() in {"[deleted]", "automoderator"}:
        return None
    age = hours_old(float(post.get("created_utc") or 0), now)
    if age > 72:
        return None

    votes = max(0, int(post.get("score") or 0))
    comments = max(0, int(post.get("num_comments") or 0))
    freshness = 38.0 * math.exp(-age / 16.0)
    engagement = min(20.0, 3.4 * math.log1p(votes) + 3.2 * math.log1p(comments))
    relevance, matched_terms = local_relevance(f"{title} {body}")
    impact, impact_terms = impact_score(f"{title} {body}", age)
    discussion = min(5.0, comments * 0.45)
    total = round(freshness + engagement + relevance + impact + discussion, 1)
    return total, {
        "freshness": round(freshness, 1),
        "engagement": round(engagement, 1),
        "burlingtonRelevance": round(relevance, 1),
        "impact": impact,
        "discussion": round(discussion, 1),
        "matchedTerms": matched_terms,
        "impactTerms": impact_terms,
        "ageHours": round(age, 2),
    }


def collect(now: dt.datetime) -> list[dict]:
    posts: dict[str, dict] = {}
    errors: list[str] = []
    for url in FEEDS:
        try:
            payload = fetch_json(url)
            for child in payload.get("data", {}).get("children", []):
                post = child.get("data", {})
                if post.get("id"):
                    posts[str(post["id"])] = post
        except Exception as exc:
            errors.append(f"{type(exc).__name__}: {exc}")
    if not posts:
        raise RuntimeError("No public Reddit data returned; " + "; ".join(errors))
    ranked = []
    for post in posts.values():
        result = score_post(post, now)
        if result:
            score, breakdown = result
            ranked.append({"post": post, "score": score, "breakdown": breakdown})
    return sorted(ranked, key=lambda item: item["score"], reverse=True)


def build_payload(winner: dict, now: dt.datetime) -> dict:
    post = winner["post"]
    permalink = str(post.get("permalink") or "")
    if permalink.startswith("/"):
        permalink = "https://www.reddit.com" + permalink
    impact = float(winner["breakdown"].get("impact") or 0)
    age = float(winner["breakdown"].get("ageHours") or 99)
    signal_type = "breaking_lead" if impact >= 10 and age <= 6 else "community_discussion"
    return {
        "status": "available",
        "checkedAt": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": "Public r/BurlingtonON posts ranked for recency, Burlington specificity, impact and then engagement. Breaking leads remain unverified until corroborated by an official or established reporting source.",
        "disclaimer": "A public community signal, not verification or polling.",
        "item": {
            "id": str(post.get("id")),
            "title": re.sub(r"\s+", " ", str(post.get("title") or "")).strip(),
            "url": permalink,
            "source": "Public Reddit · r/BurlingtonON",
            "verification": "unverified_community_report",
            "signalType": signal_type,
            "publishedAt": dt.datetime.fromtimestamp(float(post.get("created_utc") or 0), UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "votes": max(0, int(post.get("score") or 0)),
            "comments": max(0, int(post.get("num_comments") or 0)),
            "signalScore": winner["score"],
            "scoreBreakdown": winner["breakdown"],
        },
    }


def materially_changed(previous: dict, current: dict) -> bool:
    old = previous.get("item") or {}
    new = current.get("item") or {}
    return old.get("id") != new.get("id") or old.get("signalType") != new.get("signalType") or round(float(old.get("signalScore") or 0) / 5) != round(float(new.get("signalScore") or 0) / 5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/community-pulse.json")
    args = parser.parse_args()
    path = pathlib.Path(args.output)
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    now = dt.datetime.now(UTC)
    try:
        ranked = collect(now)
    except RuntimeError as exc:
        print(f"Community source unavailable; keeping the current file: {exc}")
        return 0
    if not ranked:
        print("No eligible public post cleared the publication filters.")
        return 0
    current = build_payload(ranked[0], now)
    if previous.get("status") == "available" and not materially_changed(previous, current):
        print("Community signal is unchanged.")
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Published community signal: {current['item']['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
