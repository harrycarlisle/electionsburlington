#!/usr/bin/env python3
"""Render the first-paint Burlington News homepage from generated editorial data.

The main editorial page is server-rendered so the first paint matches the live
selection rules. Live traffic and breaking/local-update scripts can still refresh
their own rails after load.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
INDEX = ROOT / "index.html"
TZ = ZoneInfo("America/Toronto")
BREAKING_MAX_AGE = dt.timedelta(hours=3)
LOCAL_UPDATE_MAX_AGE = dt.timedelta(hours=24)
RECENT_ARCHIVE_HERO_MAX_AGE = dt.timedelta(hours=18)
NEWEST_MAX_AGE = dt.timedelta(days=7)

TOPIC_LABELS = {
    "public-safety": "Public safety",
    "food": "Food",
    "development": "Development",
    "history": "History",
    "election": "Election",
    "schools": "Schools",
    "events": "Events",
    "sports": "Sports",
    "nature": "Nature",
    "traffic": "Traffic",
    "transportation": "Transportation",
    "canada": "Canada",
    "burlington": "Burlington",
}

HERO_DECK_OVERRIDES = {
    "57a3ede36411e1b6": "Several people fled as officers arrived on Mud Street East, and the Shooting Response Team is investigating what happened.",
    "police-seize-five-firearms-mud-street": "Several people fled as officers arrived on Mud Street East, and the Shooting Response Team is investigating what happened.",
    "burlington-maple-richmond-fatal-hit-and-run": "Police are asking for help finding a dark sedan after Thursday's collision near Maple Avenue and Richmond Road.",
}

STORY_ALIASES = {"burlington-hotspots-0-24": "burlington-ultimate-team-0-24"}


def load(name: str, fallback):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except Exception:
        return fallback


def clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def esc(value) -> str:
    return html.escape(clean(value), quote=True)


def public_url(item: dict) -> str:
    raw = clean(item.get("storyUrl") or item.get("url") or item.get("path"))
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    raw = raw.lstrip("/")
    match = re.fullmatch(r"articles/(?:auto/)?([^/]+)\.html", raw, flags=re.IGNORECASE)
    if match:
        slug = STORY_ALIASES.get(match.group(1), match.group(1))
        return f"/stories/{slug}/"
    return "/" + raw


def image_url(item: dict) -> str:
    raw = clean(item.get("image"))
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("/"):
        return raw
    return "/" + raw


def parse_time(value) -> dt.datetime | None:
    raw = clean(value)
    if not raw:
        return None
    try:
        if len(raw) == 10 and raw[4] == "-":
            return dt.datetime.fromisoformat(raw).replace(hour=12, tzinfo=TZ)
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except ValueError:
        return None


def timestamp(item: dict) -> dt.datetime | None:
    for key in ("lastMeaningfulUpdate", "meaningfulUpdatedAt", "publishedAt", "datePublished", "published", "activeFrom"):
        parsed = parse_time(item.get(key))
        if parsed:
            return parsed
    return None


def age(item: dict, now: dt.datetime) -> dt.timedelta:
    stamp = timestamp(item)
    if not stamp:
        return dt.timedelta.max
    return max(dt.timedelta(0), now - stamp)


def story_key(item: dict) -> str:
    return clean(item.get("id") or public_url(item) or item.get("headline"))


def unique(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for item in items:
        key = story_key(item)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def category_label(item: dict) -> str:
    label = clean(item.get("label") or item.get("category"))
    topic = clean(item.get("topic")).lower()
    if label.lower() == "roads":
        return "Traffic"
    if label:
        return label
    return TOPIC_LABELS.get(topic, "Burlington")


def editorial_family(item: dict) -> str:
    value = " ".join(clean(item.get(key)).lower() for key in ("editorialFamily", "kind", "label", "category", "topic"))
    if re.search(r"home rules|permit|parking|bylaw|service", value):
        return "service"
    if re.search(r"public safety|police|crime|shooting|fire", value):
        return "public-safety"
    if re.search(r"traffic|transport|road|qew|collision", value):
        return "traffic"
    if re.search(r"history|mystery|heritage", value):
        return "history"
    if re.search(r"development|construction|housing", value):
        return "development"
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
    return clean(item.get("topic") or item.get("category") or item.get("label") or item.get("id") or "other").lower()


def pick_diverse(items: list[dict], limit: int) -> list[dict]:
    picked: list[dict] = []
    families: set[str] = set()
    for item in items:
        family = editorial_family(item)
        if family in families:
            continue
        picked.append(item)
        families.add(family)
        if len(picked) >= limit:
            break
    return picked


def hero_deck(item: dict) -> str:
    key = clean(item.get("id"))
    if key in HERO_DECK_OVERRIDES:
        return HERO_DECK_OVERRIDES[key]
    return clean(item.get("deck") or item.get("summary") or item.get("description"))


def has_meaningful_update(item: dict) -> bool:
    published = parse_time(item.get("publishedAt") or item.get("datePublished"))
    updated = parse_time(item.get("lastMeaningfulUpdate") or item.get("meaningfulUpdatedAt"))
    return bool(published and updated and updated > published + dt.timedelta(minutes=5))


def local_context_score(item: dict) -> float:
    if item.get("localUpdateEligible") is False:
        return 0.0
    if item.get("anniversaryMatch") or clean(item.get("localUpdateReason")).lower() == "anniversary":
        return 5.0
    if item.get("localUpdateReason") or item.get("contextSignal") or item.get("relatedCurrentEvent"):
        return 5.0
    if has_meaningful_update(item):
        return 4.0
    source = clean(item.get("sourceName")).lower()
    kind = clean(item.get("kind")).lower()
    label = clean(item.get("label") or item.get("category")).lower()
    if "burlington news" in source:
        if kind == "service" or re.search(r"home rules|parking|permit", label):
            return 0.0
        return 0.0
    return 3.0


def local_rank(item: dict) -> float:
    return float(item.get("localUpdateScore") or 0) + local_context_score(item) * 0.75


def breaking_visible(live: dict, archive: dict, now: dt.datetime) -> list[dict]:
    current = [row for row in (live.get("items") or []) if isinstance(row, dict)]
    old = [row for row in (archive.get("items") or []) if isinstance(row, dict)]
    candidates = [row for row in unique(current + old) if row.get("headline") and public_url(row) and age(row, now) <= LOCAL_UPDATE_MAX_AGE]
    candidates.sort(key=lambda row: timestamp(row) or dt.datetime.min.replace(tzinfo=TZ), reverse=True)
    current_ids = {clean(row.get("id")) for row in current if row.get("id")}
    breaking_candidates = [row for row in candidates if live.get("mode") == "breaking" and clean(row.get("id")) in current_ids and age(row, now) <= BREAKING_MAX_AGE]
    if breaking_candidates:
        return candidates[:2]
    local = [row for row in candidates if local_context_score(row) > 0]
    local.sort(key=lambda row: (local_rank(row), timestamp(row) or dt.datetime.min.replace(tzinfo=TZ)), reverse=True)
    return pick_diverse(local, 2)


def clock_label(value: dt.datetime) -> str:
    local = value.astimezone(TZ)
    hour = local.hour % 12 or 12
    suffix = "A.M." if local.hour < 12 else "P.M."
    return f"{hour}:{local.minute:02d} {suffix}"


def render_breaking_section(live: dict, archive: dict, now: dt.datetime) -> str:
    visible = breaking_visible(live, archive, now)
    if not visible:
        return '<section class="breaking-now is-empty" id="breakingNow" hidden aria-hidden="true"></section>'
    current_ids = {clean(row.get("id")) for row in (live.get("items") or []) if row.get("id")}
    freshest = visible[0]
    is_breaking = live.get("mode") == "breaking" and clean(freshest.get("id")) in current_ids and age(freshest, now) <= BREAKING_MAX_AGE
    state = "breaking" if is_breaking else "local-update"
    label = "Breaking News" if is_breaking else "Local Update"
    stamp = timestamp(freshest)
    if stamp:
        prefix = "LATEST" if len(visible) > 1 else ("UPDATED" if has_meaningful_update(freshest) else "POSTED")
        status = f'<span class="breaking-status">{prefix} {clock_label(stamp)}</span>'
    else:
        status = ""
    reason = "verified story published or meaningfully updated within three hours" if is_breaking else "why-now context required; context boosts ranking; duplicate editorial families blocked"
    rows = []
    for item in visible:
        href = public_url(item)
        attrs = ' target="_blank" rel="noopener"' if href.startswith("http://") or href.startswith("https://") else ""
        rows.append(
            f'<a class="breaking-row" href="{esc(href)}" data-breaking-score="{esc(item.get("breakingScore") if item.get("breakingScore") is not None else "")}" '
            f'data-local-update-score="{esc(item.get("localUpdateScore") if item.get("localUpdateScore") is not None else "")}" data-context-score="{esc(local_context_score(item))}"{attrs}>'
            f'<strong>{esc(item.get("shortHeadline") or item.get("headline"))}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>'
        )
    return (
        f'<section class="breaking-now" id="breakingNow" data-state="{state}" data-count="{len(visible)}" data-selection-reason="{esc(reason)}">'
        f'<div class="breaking-heading"><strong>{label}</strong>{status}</div><div class="breaking-list" data-count="{len(visible)}'>{"".join(rows)}</div></section>'
    )


def choose_hero(home: dict, live: dict, archive: dict, now: dt.datetime) -> dict | None:
    if live.get("mode") == "breaking":
        for item in live.get("items") or []:
            if item.get("headline") and public_url(item) and image_url(item):
                return item
    recent_archive = [item for item in (archive.get("items") or []) if item.get("headline") and public_url(item) and image_url(item) and age(item, now) <= RECENT_ARCHIVE_HERO_MAX_AGE]
    recent_archive.sort(key=lambda item: timestamp(item) or dt.datetime.min.replace(tzinfo=TZ), reverse=True)
    if recent_archive:
        return recent_archive[0]
    for item in home.get("feature") or []:
        if item.get("headline") and public_url(item) and image_url(item):
            return item
    return None


def render_hero(item: dict) -> str:
    href = public_url(item)
    image = image_url(item)
    attrs = ' target="_blank" rel="noopener"' if href.startswith("http://") or href.startswith("https://") else ""
    deck = hero_deck(item)
    deck_html = f'<p>{esc(deck)}</p>' if deck else ""
    return (
        '<section class="lead-grid" aria-label="Top story">'
        f'<article class="top-story" data-story-id="{esc(item.get("id"))}"><a href="{esc(href)}"{attrs}>'
        f'<div class="top-image"><img src="{esc(image)}" alt="{esc(item.get("alt") or item.get("headline"))}" fetchpriority="high" decoding="async"></div>'
        f'<div class="top-copy"><span class="kicker">{esc(category_label(item))}</span><h1>{esc(item.get("headline"))}</h1>{deck_html}</div></a></article></section>'
    )


def relative_time(item: dict, now: dt.datetime) -> str:
    stamp = timestamp(item)
    if not stamp:
        return "Recent"
    local = stamp.astimezone(TZ)
    now_local = now.astimezone(TZ)
    if local.date() == now_local.date():
        hours = max(0, int((now_local - local).total_seconds() // 3600))
        return "Just now" if hours < 1 else f"{hours} hour{'s' if hours != 1 else ''} ago"
    if local.date() == now_local.date() - dt.timedelta(days=1):
        return "Yesterday"
    days = (now_local.date() - local.date()).days
    if 1 < days <= 6:
        return f"{days} days ago"
    return f"{local.strftime('%b')} {local.day}"


def newest_items(home: dict, archive: dict, hero: dict | None, now: dt.datetime) -> list[dict]:
    pool = unique(list(archive.get("items") or []) + list(home.get("latest") or []) + list(home.get("rail") or []) + list(home.get("feature") or []))
    hero_key = story_key(hero or {})
    rows = [item for item in pool if story_key(item) != hero_key and item.get("headline") and public_url(item) and timestamp(item) and age(item, now) <= NEWEST_MAX_AGE and clean(item.get("status")).lower() != "expired"]
    rows.sort(key=lambda item: timestamp(item) or dt.datetime.min.replace(tzinfo=TZ), reverse=True)
    return pick_diverse(rows, 3)


def render_newest(items: list[dict], now: dt.datetime) -> str:
    rows = [
        f'<a href="{esc(public_url(item))}" data-story-id="{esc(item.get("id"))}"><span><small>{esc(category_label(item))}</small>'
        f'<strong>{esc(item.get("headline"))}</strong><time>{esc(relative_time(item, now))}</time></span></a>'
        for item in items
    ]
    hidden = ' hidden aria-hidden="true"' if not rows else ""
    return f'<section class="newest" id="newestRail" aria-labelledby="newestTitle"{hidden}><div class="mini-heading"><h2 id="newestTitle">Newest</h2><a href="/news/">All stories →</a></div><div id="latestList" class="newest-list">{"".join(rows)}</div></section>'


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"Could not find exactly one {label} block in index.html")
    return updated


def main() -> int:
    now = dt.datetime.now(TZ)
    home = load("home-surface.json", {})
    live = load("breaking-now.json", {})
    archive = load("breaking-archive.json", {})
    hero = choose_hero(home, live, archive, now)
    if not hero:
        raise RuntimeError("No valid homepage hero was available")
    text = INDEX.read_text(encoding="utf-8")
    text = replace_once(text, r'<section class="breaking-now[^\"]*" id="breakingNow".*?</section>', render_breaking_section(live, archive, now), "breaking/local-update")
    text = replace_once(text, r'<section class="lead-grid" aria-label="Top story">.*?</section>', render_hero(hero), "hero")
    text = replace_once(text, r'<section class="newest" id="newestRail" aria-labelledby="newestTitle".*?</section>', render_newest(newest_items(home, archive, hero, now), now), "newest")
    hero_image = image_url(hero)
    text, preload_count = re.subn(r'(<link rel="preload" as="image" href=")[^"]+(" fetchpriority="high">)', lambda match: match.group(1) + hero_image + match.group(2), text, count=1)
    if preload_count != 1:
        raise RuntimeError("Could not update homepage hero preload")
    text = re.sub(r'/homepage-boot\.js\?v=[^\"]+', '/homepage-boot.js?v=20260830context1', text, count=1)
    current = INDEX.read_text(encoding="utf-8")
    if text == current:
        print("Homepage already matches generated first-paint state")
        return 0
    INDEX.write_text(text, encoding="utf-8")
    print(f"Rendered homepage: hero={story_key(hero)}, newest={len(newest_items(home, archive, hero, now))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
