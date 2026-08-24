#!/usr/bin/env python3
"""Rank public Burlington discussion without treating social posts as evidence.

The homepage publishes one *conversation signal*, never a poll or news fact. Posts
must come from a public local feed and clear basic safety and quality filters.
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
USER_AGENT = "BurlingtonNewsCommunitySignal/1.0 (+https://burlingtonnews.ca/methodology.html#community-signal)"
FEEDS = (
    "https://www.reddit.com/r/BurlingtonON/hot.json?raw_json=1&limit=75",
    "https://www.reddit.com/r/BurlingtonON/new.json?raw_json=1&limit=75",
)
LOCAL_TERMS = {
    "burlington", "aldershot", "alton", "brant", "burloak", "downtown",
    "headon", "tyandaga", "orchard", "roseland", "tansley", "appleby",
    "guelph line", "new street", "lakeshore", "skyway", "beachway",
    "spencer smith", "mount nemo", "kerncliff", "lasalle", "rbg",
    "bayhawks", "burlington blast", "ribfest", "city council", "ward",
}
BLOCKED = re.compile(r"\b(buy|sell|for sale|promo code|referral|onlyfans|escort|hookup)\b", re.I)


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def hours_old(created: float, now: dt.datetime) -> float:
    created_at = dt.datetime.fromtimestamp(created, UTC)
    return max(0.0, (now - created_at).total_seconds() / 3600)


def local_relevance(text: str) -> tuple[float, list[str]]:
    lower = text.lower()
    matches = sorted(term for term in LOCAL_TERMS if term in lower)
    # Posts in a Burlington-only forum receive a baseline, but specificity matters.
    return min(20.0, 10.0 + len(matches) * 2.5), matches[:4]


def score_post(post: dict, now: dt.datetime) -> tuple[float, dict] | None:
    title = re.sub(r"\s+", " ", str(post.get("title") or "")).strip()
    if not (16 <= len(title) <= 180) or BLOCKED.search(title):
        return None
    if post.get("stickied") or post.get("over_18") or post.get("removed_by_category"):
        return None
    if str(post.get("author") or "").lower() in {"[deleted]", "automoderator"}:
        return None
    age = hours_old(float(post.get("created_utc") or 0), now)
    if age > 96:
        return None

    votes = max(0, int(post.get("score") or 0))
    comments = max(0, int(post.get("num_comments") or 0))
    freshness = 35.0 * math.exp(-age / 30.0)
    engagement = min(30.0, 5.2 * math.log1p(votes) + 4.4 * math.log1p(comments))
    relevance, matched_terms = local_relevance(f"{title} {post.get('selftext') or ''}")
    discussion = min(10.0, comments * 0.85)
    public_source = 5.0
    total = round(freshness + engagement + relevance + discussion + public_source, 1)
    return total, {
        "freshness": round(freshness, 1),
        "engagement": round(engagement, 1),
        "burlingtonRelevance": round(relevance, 1),
        "discussion": round(discussion, 1),
        "publicSource": public_source,
        "matchedTerms": matched_terms,
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
        except Exception as exc:  # keep the last valid signal if a source is down
            errors.append(f"{type(exc).__name__}: {exc}")
    if not posts:
        raise RuntimeError("No public Reddit data returned; " + "; ".join(errors))

    ranked: list[dict] = []
    for post in posts.values():
        result = score_post(post, now)
        if not result:
            continue
        score, breakdown = result
        ranked.append({"post": post, "score": score, "breakdown": breakdown})
    return sorted(ranked, key=lambda item: item["score"], reverse=True)


def build_payload(winner: dict, now: dt.datetime) -> dict:
    post = winner["post"]
    permalink = str(post.get("permalink") or "")
    if permalink.startswith("/"):
        permalink = "https://www.reddit.com" + permalink
    return {
        "status": "available",
        "checkedAt": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": "Public r/BurlingtonON posts ranked for freshness, engagement, Burlington specificity and discussion. Rechecked hourly; republished only when the leading signal materially changes.",
        "disclaimer": "A public conversation signal, not a poll or proof that most Burlington residents agree.",
        "item": {
            "id": str(post.get("id")),
            "title": re.sub(r"\s+", " ", str(post.get("title") or "")).strip(),
            "url": permalink,
            "source": "Public Reddit · r/BurlingtonON",
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
    return old.get("id") != new.get("id") or round(float(old.get("signalScore") or 0) / 5) != round(float(new.get("signalScore") or 0) / 5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/community-pulse.json")
    args = parser.parse_args()
    path = pathlib.Path(args.output)
    previous = {}
    if path.exists():
        previous = json.loads(path.read_text(encoding="utf-8"))
    now = dt.datetime.now(UTC)
    try:
        ranked = collect(now)
    except RuntimeError as exc:
        # A temporary platform block must not erase the last valid signal or make
        # an hourly workflow noisy. The next scheduled check will try again.
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
