#!/usr/bin/env python3
"""Generate crawlable /events/<slug>/ pages from explore-events.json."""
from __future__ import annotations

import json
from datetime import datetime
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data" / "explore-events.json").read_text(encoding="utf-8"))


def iso(value: str) -> str:
    return value or ""


def page_html(event: dict) -> str:
    slug = event["slug"]
    title = event["title"]
    url = f"https://burlingtonnews.ca/events/{slug}/"
    image = event.get("image") or "/assets/explore/farmers-market.webp"
    if not image.startswith("http"):
        image_abs = f"https://burlingtonnews.ca/{image.lstrip('/')}"
    else:
        image_abs = image
    start = event.get("start", "")
    end = event.get("end", "")
    price = event.get("price") or "See official source"
    why = event.get("summary") or ""
    details = event.get("details") or ""
    location = event.get("location") or ""
    venue = event.get("venue") or location
    address = location
    parking = "Use the venue notes and official page for parking and transit. Downtown events often share the Locust Street garage after 6 p.m."
    weather = "Outdoor events can be delayed or cancelled for weather. Check the official source the day of."
    updated = event.get("verifiedAt") or DATA.get("updated") or "2026-08-26"
    source = event.get("source") or ""
    source_name = event.get("sourceName") or "Official source"
    ld = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": title,
        "startDate": start,
        "endDate": end,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "description": why,
        "url": url,
        "image": image_abs,
        "location": {
            "@type": "Place",
            "name": venue,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": address,
                "addressLocality": event.get("city") or "Burlington",
                "addressRegion": "ON",
                "addressCountry": "CA",
            },
        },
        "organizer": {"@type": "Organization", "name": source_name, "url": source},
        "offers": {"@type": "Offer", "url": source, "price": price, "availability": "https://schema.org/InStock"},
    }
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://burlingtonnews.ca/"},
            {"@type": "ListItem", "position": 2, "name": "Explore", "item": "https://burlingtonnews.ca/explore/"},
            {"@type": "ListItem", "position": 3, "name": title},
        ],
    }
    nearby = "NEARBY" if event.get("scope") != "Burlington" else "Burlington"
    return f"""<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} | Burlington News</title>
<meta name="description" content="{escape(why)[:155]}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(why)[:155]}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image_abs}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png">
<meta name="theme-color" content="#071b35">
<link rel="stylesheet" href="/site-extra.css?v=20260826seo">
<link rel="stylesheet" href="/site-bundle.css?v=20260824z4">
<link rel="stylesheet" href="/site-shell.css?v=20260824z5">
<link rel="stylesheet" href="/authority.css?v=20260826seo">
<script src="/site-extra.js?v=20260826seo" defer></script>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(crumbs, ensure_ascii=False)}</script>
</head>
<body class="authority-page">
<a class="skip" href="#main">Skip to content</a>
<header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header>
<main id="main" class="authority-shell">
<nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="/">Home</a> /</li><li><a href="/explore/">Explore</a> /</li><li>{escape(title)}</li></ol></nav>
<p class="authority-kicker">{escape(event.get("category") or "Event")} · {escape(nearby)}</p>
<h1>{escape(title)}</h1>
<p class="authority-hook">{escape(why)}</p>
<section class="direct-answer"><h2>Why go</h2><p>{escape(why)}</p></section>
<section class="authority-section">
<table class="data-table">
<tbody>
<tr><th>Date</th><td>{escape(event.get("dateLabel") or start)}</td></tr>
<tr><th>Time</th><td>{escape(event.get("dateLabel") or "")}</td></tr>
<tr><th>Venue</th><td>{escape(venue)}</td></tr>
<tr><th>Address</th><td>{escape(address)}</td></tr>
<tr><th>Price</th><td>{escape(price)}</td></tr>
<tr><th>Official link</th><td><a href="{escape(source)}" rel="noopener">{escape(source_name)}</a></td></tr>
</tbody>
</table>
</section>
<section class="authority-section">
<h2>Details</h2>
<p>{escape(details)}</p>
<p><strong>Parking / transit:</strong> {escape(event.get("travel") or parking)}</p>
<p><strong>Weather / cancellation:</strong> {escape(weather)}</p>
</section>
<div class="map-frame"><iframe title="Map of {escape(venue)}" src="https://maps.google.com/maps?q={escape(address)}&amp;output=embed" loading="lazy"></iframe></div>
<p class="hub-links"><a href="/explore/">Explore calendar</a><a href="/explore/weekend/">This weekend</a><a href="/parking/">Parking tonight</a></p>
<p class="updated">Source: {escape(source_name)}. Verified {escape(str(updated))}.</p>
</main>
</body>
</html>
"""


def main() -> int:
    count = 0
    for event in DATA.get("events", []):
        slug = event.get("slug")
        if not slug:
            continue
        dest = ROOT / "events" / slug / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page_html(event), encoding="utf-8")
        count += 1
    print(f"Wrote {count} event pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
