#!/usr/bin/env python3
"""Turn verified Breaking News items into durable Burlington News briefs.

Every item that actually appears in Breaking News gets a stable internal article URL
and is retained in breaking-archive.json. Once it is no longer the active breaking
item, the homepage can move it naturally into Newest instead of making it disappear.

The generated brief is intentionally conservative: it publishes only facts present in
the verified breaking payload and links prominently to the source of record.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

from story_lifecycle import has_newer_update, is_resolved, lifecycle_status, update_time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BREAKING = DATA / "breaking-now.json"
ARCHIVE = DATA / "breaking-archive.json"
STORIES = ROOT / "stories"
TZ = ZoneInfo("America/Toronto")
STOPWORDS = {
    "after", "about", "again", "from", "have", "into", "near", "over", "that",
    "their", "there", "these", "they", "this", "those", "through", "with", "what",
    "when", "where", "which", "will", "your", "says", "said", "news", "burlington",
}


def load(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def slugify(value: str) -> str:
    value = value.lower().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:80] or "breaking-update"


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def content_words(value: str) -> set[str]:
    return {
        word for word in re.findall(r"[a-z0-9]+", clean(value).lower())
        if len(word) > 3 and word not in STOPWORDS
    }


def repeats_headline(headline: str, deck: str) -> bool:
    head = content_words(headline)
    body = content_words(deck)
    if not head or not body:
        return False
    overlap = len(head & body)
    return overlap >= 3 and (overlap / max(1, min(len(head), len(body)))) >= 0.62


def deck_for(item: dict) -> str:
    """Return only an additive verified deck.

    If the source summary simply restates the headline, omit the deck rather than
    manufacturing a curiosity line. Editors/collectors can provide item.deck when
    they have another verified fact, tension, or unresolved detail.
    """
    headline = clean(item.get("headline"))
    for raw in (item.get("deck"), item.get("summary"), item.get("description")):
        candidate = clean(raw)
        if not candidate or repeats_headline(headline, candidate):
            continue
        words = candidate.split()
        if len(words) <= 30:
            return candidate
        first_sentence = re.split(r"(?<=[.!?])\s+", candidate, maxsplit=1)[0].strip()
        if first_sentence and len(first_sentence.split()) <= 30 and not repeats_headline(headline, first_sentence):
            return first_sentence
    return ""


def topic_for(item: dict) -> str:
    category = clean(item.get("category") or item.get("label")).lower()
    event = clean(item.get("eventType")).lower()
    if event == "police" or "public safety" in category:
        return "public-safety"
    if "traffic" in category or event in {"traffic", "road"}:
        return "traffic"
    if "weather" in category or event == "weather":
        return "weather"
    return "burlington"


def image_for(item: dict) -> tuple[str, str]:
    if item.get("image"):
        return str(item["image"]), clean(item.get("alt")) or "Burlington News breaking-news image."
    if topic_for(item) == "public-safety":
        return "/assets/cops-2.png", "Police vehicles and emergency lights at a nighttime police scene."
    return "/assets/editorial/home-share.webp", "Burlington News."


def published_at(item: dict, now: dt.datetime) -> str:
    raw = clean(item.get("publishedAt") or item.get("lastMeaningfulUpdate") or item.get("updatedAt"))
    if raw:
        return raw
    # Breaking eligibility requires a real source time, so this is a final
    # defensive fallback for malformed hand-authored data, not a display rule.
    return now.isoformat()


def article_html(item: dict, story_url: str, image: str, alt: str, now: dt.datetime) -> str:
    title = clean(item.get("headline") or "Breaking local update")
    summary = clean(item.get("summary"))
    deck = deck_for(item)
    source_name = clean(item.get("sourceName")) or "Official source"
    source_url = clean(item.get("sourceUrl"))
    location = clean(item.get("location") or item.get("nearestIntersection"))
    city = clean(item.get("city"))
    date_iso = published_at(item, now)
    try:
        date_label = dt.datetime.fromisoformat(date_iso.replace("Z", "+00:00")).astimezone(TZ).strftime("%B %-d, %Y")
    except Exception:
        date_label = now.strftime("%B %-d, %Y")
    meta_description = deck or summary or f"Verified update from {source_name}."
    body = []
    if summary:
        body.append(f"<p>{html.escape(summary)}</p>")
    else:
        body.append(f"<p>{html.escape(source_name)} reported {html.escape(title.rstrip('.'))}.</p>")
    if location:
        body.append(f"<p>The reported location is {html.escape(location)}.</p>")
    elif city:
        body.append(f"<p>The update concerns {html.escape(city)}.</p>")
    resolved = is_resolved(item)
    if resolved:
        body.append("<p>The active incident has ended. Burlington News will update this page if the source publishes additional verified details.</p>")
    else:
        body.append("<p>This is a developing story. Burlington News will update this page if additional verified information becomes available.</p>")
    source_markup = f'<a href="{html.escape(source_url)}" target="_blank" rel="noopener">{html.escape(source_name)}</a>' if source_url else html.escape(source_name)
    body.append(f'<section class="sources"><h2>Source</h2><p>{source_markup}</p></section>')
    absolute_image = image if image.startswith("http") else f"https://burlingtonnews.ca{image}"
    canonical = f"https://burlingtonnews.ca{story_url}"
    category = clean(item.get("category") or item.get("label")) or "Local update"
    kicker = "Resolved" if resolved else category.title()
    deck_markup = f'<p class="article-deck">{html.escape(deck)}</p>' if deck else ''
    return f'''<!doctype html>
<html lang="en-CA"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} | Burlington News</title>
<meta name="description" content="{html.escape(meta_description)}"><link rel="canonical" href="{canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/assets/brand/favicon-16x16.png"><link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#071b35">
<link rel="stylesheet" href="/article.css?v=20260828breaking"><link rel="stylesheet" href="/site-extra.css?v=20260828breaking"><script src="/theme-boot.js?v=20260828breaking"></script><script src="/site-extra.js?v=20260828breaking" defer></script>
<meta property="og:type" content="article"><meta property="og:site_name" content="Burlington News"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(meta_description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{html.escape(absolute_image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{html.escape(absolute_image)}">
</head><body>
<a class="skip" href="#article">Skip to article</a>
<header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header>
<main class="article" id="article"><header class="article-head"><div class="article-kicker">{html.escape(kicker)}</div><h1>{html.escape(title)}</h1>{deck_markup}</header>
<figure class="article-hero"><img src="{html.escape(image)}" alt="{html.escape(alt)}" fetchpriority="high"><figcaption>Burlington News visual</figcaption></figure>
<div class="article-post-hero-meta"><div class="article-byline"><strong>By Burlington News</strong><span>{html.escape(date_label)}</span><span>1 min read</span></div></div>
<div class="article-layout"><article class="article-body">{''.join(body)}</article></div></main>
</body></html>'''


def story_target(story_url: str) -> Path | None:
    match = re.fullmatch(r"/stories/([^/]+)/?", clean(story_url))
    if not match:
        return None
    return STORIES / match.group(1) / "index.html"


def update_existing_brief(existing: dict, item: dict, now: dt.datetime) -> bool:
    """Apply a substantive follow-up without reviving breaking urgency."""
    incoming_status = lifecycle_status(item)
    existing_status = lifecycle_status(existing)
    newer = has_newer_update(item, existing)
    lifecycle_changed = incoming_status == "resolved" and existing_status != "resolved"
    if not newer and not lifecycle_changed:
        return False

    title = clean(item.get("headline") or item.get("shortHeadline"))
    deck = deck_for(item)
    if title:
        existing["headline"] = title
    if deck:
        existing["deck"] = deck
    existing["status"] = "resolved" if incoming_status == "resolved" else "updated"
    existing["lifecycleStatus"] = incoming_status
    stamp = update_time(item) or now
    existing["lastMeaningfulUpdate"] = stamp.isoformat()
    existing["dateModified"] = stamp.isoformat()

    if existing.get("generatedBrief"):
        target = story_target(str(existing.get("url") or ""))
        if target and target.exists():
            default_image, default_alt = image_for(item)
            image = clean(existing.get("image")) or default_image
            alt = clean(existing.get("alt")) or default_alt
            merged = {
                **existing,
                **item,
                "headline": existing.get("headline"),
                "deck": existing.get("deck"),
                "publishedAt": existing.get("publishedAt"),
                "datePublished": existing.get("datePublished"),
                "status": existing.get("status"),
                "lifecycleStatus": incoming_status,
            }
            target.write_text(
                article_html(merged, str(existing.get("url")), image, alt, now),
                encoding="utf-8",
            )
    return True


def main() -> int:
    now = dt.datetime.now(TZ)
    breaking = load(BREAKING, {"items": []})
    archive = load(ARCHIVE, {"items": []})
    rows = archive.setdefault("items", [])
    by_source = {clean(row.get("sourceUrl")): row for row in rows if clean(row.get("sourceUrl"))}
    by_id = {str(row.get("id") or ""): row for row in rows if row.get("id")}
    created = 0
    updated = 0

    public_items = list(breaking.get("items") or [])
    lifecycle_updates = list(breaking.get("lifecycleUpdates") or [])
    for item in public_items + lifecycle_updates:
        source_url = clean(item.get("sourceUrl"))
        existing = (
            by_source.get(source_url)
            or by_id.get(str(item.get("id") or ""))
            or by_id.get(str(item.get("followUpTo") or ""))
        )
        if existing:
            item["storyUrl"] = existing.get("url") or item.get("storyUrl")
            item["image"] = existing.get("image") or item.get("image")
            item["alt"] = existing.get("alt") or item.get("alt")
            if update_existing_brief(existing, item, now):
                updated += 1
            continue

        if breaking.get("mode") != "breaking" or is_resolved(item):
            continue

        slug = slugify(item.get("headline") or item.get("id") or "breaking-update")
        story_url = f"/stories/{slug}/"
        target = STORIES / slug / "index.html"
        image, alt = image_for(item)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(article_html(item, story_url, image, alt, now), encoding="utf-8")
            created += 1
        item["storyUrl"] = story_url
        item["image"] = image
        item["alt"] = alt
        archive_row = {
            "id": item.get("id") or slug,
            "headline": clean(item.get("headline")),
            "deck": deck_for(item),
            "label": clean(item.get("category")) or "Local update",
            "topic": topic_for(item),
            "url": story_url,
            "sourceUrl": source_url,
            "image": image,
            "alt": alt,
            "publishedAt": published_at(item, now),
            "datePublished": published_at(item, now),
            "status": "breaking",
            "lifecycleStatus": lifecycle_status(item),
            "generatedBrief": True,
        }
        rows.insert(0, archive_row)
        if source_url:
            by_source[source_url] = archive_row
        by_id[str(archive_row["id"])] = archive_row

    # Past breaking items stay in this archive and naturally age into Newest.
    unique = []
    seen = set()
    for row in rows:
        key = clean(row.get("sourceUrl")) or str(row.get("id") or row.get("url") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(row)
    archive["items"] = unique[:100]
    archive["updatedAt"] = now.isoformat()
    BREAKING.write_text(json.dumps(breaking, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ARCHIVE.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {created} new breaking brief(s), updated {updated}; archive contains {len(unique)} story/stories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
