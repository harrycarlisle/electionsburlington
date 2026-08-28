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

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BREAKING = DATA / "breaking-now.json"
ARCHIVE = DATA / "breaking-archive.json"
STORIES = ROOT / "stories"
TZ = ZoneInfo("America/Toronto")


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
    raw = clean(item.get("publishedAt") or item.get("discoveredAt"))
    if raw:
        return raw
    return now.isoformat()


def article_html(item: dict, story_url: str, image: str, alt: str, now: dt.datetime) -> str:
    title = clean(item.get("headline") or "Breaking local update")
    summary = clean(item.get("summary"))
    source_name = clean(item.get("sourceName")) or "Official source"
    source_url = clean(item.get("sourceUrl"))
    location = clean(item.get("location") or item.get("nearestIntersection"))
    city = clean(item.get("city"))
    date_iso = published_at(item, now)
    try:
        date_label = dt.datetime.fromisoformat(date_iso.replace("Z", "+00:00")).astimezone(TZ).strftime("%B %-d, %Y")
    except Exception:
        date_label = now.strftime("%B %-d, %Y")
    deck = summary or (f"{source_name} reported the update. Burlington News is monitoring for additional confirmed details.")
    body = []
    if summary:
        body.append(f"<p>{html.escape(summary)}</p>")
    else:
        body.append(f"<p>{html.escape(source_name)} reported {html.escape(title.rstrip('.'))}.</p>")
    if location:
        body.append(f"<p>The reported location is {html.escape(location)}.</p>")
    elif city:
        body.append(f"<p>The update concerns {html.escape(city)}.</p>")
    body.append("<p>This is a developing story. Burlington News will update this page if additional verified information becomes available.</p>")
    source_markup = f'<a href="{html.escape(source_url)}" target="_blank" rel="noopener">{html.escape(source_name)}</a>' if source_url else html.escape(source_name)
    body.append(f'<section class="sources"><h2>Source</h2><p>{source_markup}</p></section>')
    absolute_image = image if image.startswith("http") else f"https://burlingtonnews.ca{image}"
    canonical = f"https://burlingtonnews.ca{story_url}"
    return f'''<!doctype html>
<html lang="en-CA"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} | Burlington News</title>
<meta name="description" content="{html.escape(deck)}"><link rel="canonical" href="{canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/assets/brand/favicon-16x16.png"><link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#071b35">
<link rel="stylesheet" href="/article.css?v=20260828breaking"><link rel="stylesheet" href="/site-extra.css?v=20260828breaking"><script src="/theme-boot.js?v=20260828breaking"></script><script src="/site-extra.js?v=20260828breaking" defer></script>
<meta property="og:type" content="article"><meta property="og:site_name" content="Burlington News"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(deck)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{html.escape(absolute_image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{html.escape(absolute_image)}">
</head><body>
<a class="skip" href="#article">Skip to article</a>
<header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header>
<main class="article" id="article"><header class="article-head"><div class="article-kicker">Breaking News</div><h1>{html.escape(title)}</h1></header>
<figure class="article-hero"><img src="{html.escape(image)}" alt="{html.escape(alt)}" fetchpriority="high"><figcaption>Burlington News visual</figcaption></figure>
<div class="article-post-hero-meta"><div class="article-byline"><strong>By Burlington News</strong><span>{html.escape(date_label)}</span><span>1 min read</span></div></div>
<div class="article-layout"><article class="article-body">{''.join(body)}</article></div></main>
</body></html>'''


def main() -> int:
    now = dt.datetime.now(TZ)
    breaking = load(BREAKING, {"items": []})
    archive = load(ARCHIVE, {"items": []})
    rows = archive.setdefault("items", [])
    by_source = {clean(row.get("sourceUrl")): row for row in rows if clean(row.get("sourceUrl"))}
    by_id = {str(row.get("id") or ""): row for row in rows if row.get("id")}
    created = 0

    if breaking.get("mode") == "breaking":
        for item in breaking.get("items") or []:
            source_url = clean(item.get("sourceUrl"))
            existing = by_source.get(source_url) or by_id.get(str(item.get("id") or ""))
            if existing:
                item["storyUrl"] = existing.get("url") or item.get("storyUrl")
                item["image"] = existing.get("image") or item.get("image")
                item["alt"] = existing.get("alt") or item.get("alt")
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
                "deck": clean(item.get("summary")) or f"{clean(item.get('sourceName')) or 'An official source'} reported this developing update.",
                "label": clean(item.get("category")) or "Breaking News",
                "topic": topic_for(item),
                "url": story_url,
                "sourceUrl": source_url,
                "image": image,
                "alt": alt,
                "publishedAt": published_at(item, now),
                "datePublished": published_at(item, now),
                "status": "breaking",
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
    print(f"Published {created} new breaking brief(s); archive contains {len(unique)} story/stories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
