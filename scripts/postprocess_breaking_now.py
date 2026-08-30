#!/usr/bin/env python3
"""Safety pass for live-rail links, punctuation and Local Update eligibility."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "breaking-now.json"
ARTICLES = ROOT / "articles"
STORIES = ROOT / "stories"


def display_headline(value) -> str:
    """Article cards do not end in a full stop; question and exclamation marks stay."""
    return re.sub(r"\.+$", "", str(value or "").strip())


def editorial_family(item: dict) -> str:
    value = " ".join(
        str(item.get(key) or "").strip().lower()
        for key in ("editorialFamily", "kind", "label", "category", "topic")
    )
    if re.search(r"home rules|permit|parking|bylaw|service", value):
        return "service"
    if re.search(r"public safety|police|crime|shooting|fire", value):
        return "public-safety"
    if re.search(r"traffic|transport|road|qew|collision", value):
        return "traffic"
    if re.search(r"development|construction|housing", value):
        return "development"
    if re.search(r"history|mystery|heritage", value):
        return "history"
    if re.search(r"food|restaurant|drink", value):
        return "food"
    if "sport" in value:
        return "sports"
    if re.search(r"event|festival", value):
        return "events"
    if re.search(r"school|education", value):
        return "schools"
    if re.search(r"election|council|politic", value):
        return "civic"
    return str(item.get("topic") or item.get("category") or item.get("label") or item.get("id") or "other").lower()


def parse_time(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def has_meaningful_update(item: dict) -> bool:
    published = parse_time(item.get("publishedAt") or item.get("datePublished"))
    updated = parse_time(item.get("lastMeaningfulUpdate") or item.get("meaningfulUpdatedAt"))
    if not published or not updated:
        return False
    if published.tzinfo is None:
        published = published.replace(tzinfo=dt.timezone.utc)
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=dt.timezone.utc)
    return updated > published + dt.timedelta(minutes=5)


def has_why_now(item: dict) -> bool:
    if item.get("localUpdateEligible") is False:
        return False
    if item.get("anniversaryMatch"):
        return True
    if item.get("localUpdateReason") or item.get("contextSignal") or item.get("relatedCurrentEvent"):
        return True
    if has_meaningful_update(item):
        return True
    source = str(item.get("sourceName") or "").strip().lower()
    return bool(source and source != "burlington news")


def internal_story_for_source(source_url: str) -> str:
    source_key = str(source_url or "").strip().rstrip("/")
    if not source_key.startswith(("https://", "http://")):
        return ""

    candidates = list(STORIES.glob("*/index.html"))
    candidates += list(ARTICLES.glob("*.html"))
    candidates += list((ARTICLES / "auto").glob("*.html"))

    for page in candidates:
        try:
            content = page.read_text(encoding="utf-8")
        except OSError:
            continue
        if source_key not in content:
            continue

        canonical = re.search(
            r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']https://burlingtonnews\.ca([^"\']+)["\']',
            content,
            re.I,
        )
        if canonical:
            return canonical.group(1)
        if page.name == "index.html" and page.parent.parent.name == "stories":
            return f"/stories/{page.parent.name}/"
        if page.parent == ARTICLES:
            return f"/articles/{page.name}"
        if page.parent == ARTICLES / "auto":
            return f"/articles/auto/{page.name}"
    return ""


def main() -> int:
    payload = json.loads(PATH.read_text(encoding="utf-8"))
    changed = False
    normalized = []

    for raw in payload.get("items") or []:
        item = dict(raw)
        for key in ("headline", "shortHeadline"):
            if item.get(key):
                cleaned = display_headline(item.get(key))
                if cleaned != item.get(key):
                    item[key] = cleaned
                    changed = True

        current = str(item.get("storyUrl") or "")
        source = str(item.get("sourceName") or "").lower()
        category = str(item.get("category") or "").lower()
        source_url = str(item.get("sourceUrl") or "")

        internal = internal_story_for_source(source_url)
        if internal:
            target = internal
        elif current not in {"", "/news/", "/live/"} and not current.startswith("/live/?"):
            target = current
        elif "ontario 511" in source or category == "traffic":
            target = "/traffic/"
        elif source_url.startswith(("https://", "http://", "/")):
            target = source_url
        else:
            target = "/news/"

        if target != current:
            item["storyUrl"] = target
            changed = True
        normalized.append(item)

    if payload.get("mode") != "breaking":
        eligible = [item for item in normalized if has_why_now(item)]
        picked = []
        families = set()
        for item in eligible:
            family = editorial_family(item)
            if family in families:
                changed = True
                continue
            picked.append(item)
            families.add(family)
            if len(picked) >= 2:
                break
        if len(picked) != len(normalized):
            changed = True
        normalized = picked
        if not normalized:
            payload["method"] = "No Local Update was shown because no item had a clear why-now signal."
            changed = True

    payload["items"] = normalized[:2]
    if changed:
        PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Live rail destinations, headline punctuation and Local Update eligibility normalized")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
