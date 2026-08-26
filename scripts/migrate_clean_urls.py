#!/usr/bin/env python3
"""Clean-URL migration for Burlington News (GitHub Pages).

Moves remaining public .html pages into directory indexes, writes HTML
redirect stubs for every known legacy path, and rewrites internal
.burlingtonnews.ca / relative .html links to trailing-slash canonicals.

Does not rewrite third-party URLs. Does not copy stubs over story pages.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://burlingtonnews.ca"
TODAY = date.today().isoformat()

# Old public file path -> final trailing-slash canonical. One hop only.
REDIRECTS: list[tuple[str, str]] = [
    ("explore.html", "/explore/"),
    ("sports.html", "/sports/"),
    ("election-guide.html", "/elections/"),
    ("updates.html", "/news/"),
    ("skyway-traffic.html", "/traffic/"),
    ("puzzles.html", "/games/"),
    ("about.html", "/about/"),
    ("ward.html", "/elections/ward/"),
    ("food-passport.html", "/food-passport/"),
    ("work-with-us.html", "/work-with-us/"),
    ("methodology.html", "/sources/"),
    ("help.html", "/accessibility/"),
    ("privacy.html", "/privacy/"),
    ("terms.html", "/terms/"),
    ("independent.html", "/independent/"),
    ("ballot.html", "/elections/ballot/"),
    ("head-to-head.html", "/elections/head-to-head/"),
    ("elections-for-beginners.html", "/elections/beginners/"),
    ("promises.html", "/elections/promises/"),
    ("guides/burlington-food-spots.html", "/food-passport/"),
    ("guides/best-of-burlington.html", "/guides/best-of-burlington/"),
    ("puzzles/index.html", "/games/"),
    ("elections/mayor/index.html", "/elections/compare/"),
]

MOVES: list[tuple[str, str]] = [
    ("methodology.html", "sources/index.html"),
    ("help.html", "accessibility/index.html"),
    ("privacy.html", "privacy/index.html"),
    ("terms.html", "terms/index.html"),
    ("independent.html", "independent/index.html"),
    ("ballot.html", "elections/ballot/index.html"),
    ("head-to-head.html", "elections/head-to-head/index.html"),
    ("elections-for-beginners.html", "elections/beginners/index.html"),
    ("promises.html", "elections/promises/index.html"),
    ("guides/best-of-burlington.html", "guides/best-of-burlington/index.html"),
]

REWRITE_SKIP = {
    "scripts/migrate_clean_urls.py",
    "scripts/sync_public_urls.py",
    "home.js",  # keeps old→new fallbacks for leftover data
}

REWRITE_SUFFIXES = {".html", ".js", ".json", ".xml", ".md", ".txt", ".webmanifest"}

# Longest-first exact replacements after article-slug rewrite.
PAGE_REPLACEMENTS = [
    ("/elections-for-beginners.html", "/elections/beginners/"),
    ("elections-for-beginners.html", "/elections/beginners/"),
    ("/guides/burlington-food-spots.html", "/food-passport/"),
    ("guides/burlington-food-spots.html", "/food-passport/"),
    ("/guides/best-of-burlington.html", "/guides/best-of-burlington/"),
    ("guides/best-of-burlington.html", "/guides/best-of-burlington/"),
    ("/election-guide.html", "/elections/"),
    ("election-guide.html", "/elections/"),
    ("/head-to-head.html", "/elections/head-to-head/"),
    ("head-to-head.html", "/elections/head-to-head/"),
    ("/skyway-traffic.html", "/traffic/"),
    ("skyway-traffic.html", "/traffic/"),
    ("/food-passport.html", "/food-passport/"),
    ("food-passport.html", "/food-passport/"),
    ("/work-with-us.html", "/work-with-us/"),
    ("work-with-us.html", "/work-with-us/"),
    ("/methodology.html", "/sources/"),
    ("methodology.html", "/sources/"),
    ("/help.html", "/accessibility/"),
    ("help.html", "/accessibility/"),
    ("/privacy.html", "/privacy/"),
    ("privacy.html", "/privacy/"),
    ("/terms.html", "/terms/"),
    ("terms.html", "/terms/"),
    ("/independent.html", "/independent/"),
    ("independent.html", "/independent/"),
    ("/ballot.html", "/elections/ballot/"),
    ("ballot.html", "/elections/ballot/"),
    ("/promises.html", "/elections/promises/"),
    ("promises.html", "/elections/promises/"),
    ("/about.html", "/about/"),
    ("about.html", "/about/"),
    ("/ward.html", "/elections/ward/"),
    ("ward.html", "/elections/ward/"),
    ("/explore.html", "/explore/"),
    ("explore.html", "/explore/"),
    ("/sports.html", "/sports/"),
    ("sports.html", "/sports/"),
    ("/updates.html", "/news/"),
    ("updates.html", "/news/"),
    ("/puzzles.html", "/games/"),
    ("puzzles.html", "/games/"),
    ("../index.html", "/"),
    ('href="/index.html"', 'href="/"'),
    ('href="index.html"', 'href="/"'),
    ("href='index.html'", "href='/'"),
]


def canonical_for_dest(dest: str) -> str:
    parent = Path(dest).parent.as_posix()
    return "/" if parent == "." else f"/{parent}/"


def redirect_stub(dest: str) -> str:
    dest_abs = ORIGIN + dest
    return (
        "<!doctype html>\n"
        '<html lang="en-CA">\n'
        "<head>\n"
        '  <meta charset="utf-8">\n'
        '  <meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f"  <title>Moved — Burlington News</title>\n"
        f'  <link rel="canonical" href="{dest_abs}">\n'
        f'  <meta http-equiv="refresh" content="0;url={dest}">\n'
        '  <meta name="robots" content="noindex,follow">\n'
        f"  <script>location.replace({dest!r})</script>\n"
        "</head>\n"
        "<body>\n"
        f'  <p>This page has moved to <a href="{dest}">{dest_abs}</a>.</p>\n'
        "</body>\n"
        "</html>\n"
    )


def write_stub(rel: str, dest: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(redirect_stub(dest), encoding="utf-8")


def rewrite_self_urls(html: str, new_path: str) -> str:
    abs_url = ORIGIN + new_path
    if 'rel="canonical"' in html:
        html = re.sub(
            r'<link rel="canonical" href="[^"]*">',
            f'<link rel="canonical" href="{abs_url}">',
            html,
            count=1,
        )
    else:
        html = html.replace(
            "<head>",
            f'<head>\n  <link rel="canonical" href="{abs_url}">\n  <meta property="og:url" content="{abs_url}">',
            1,
        )
    if 'property="og:url"' in html:
        html = re.sub(
            r'<meta property="og:url" content="[^"]*">',
            f'<meta property="og:url" content="{abs_url}">',
            html,
        )
    elif "<head>" in html:
        html = html.replace(
            "<head>",
            f'<head>\n  <meta property="og:url" content="{abs_url}">',
            1,
        )
    html = re.sub(
        r'("url":\s*")https://burlingtonnews\.ca/[^"]*(")',
        rf"\1{abs_url}\2",
        html,
        count=1,
    )
    html = re.sub(
        r'("mainEntityOfPage":\s*")https://burlingtonnews\.ca/[^"]*(")',
        rf"\1{abs_url}\2",
        html,
        count=1,
    )
    return html


def fix_moved_assets(html: str) -> str:
    html = html.replace('href="site-extra.css', 'href="/site-extra.css')
    html = html.replace("href='site-extra.css", "href='/site-extra.css")
    html = html.replace('href="ux-v6.css', 'href="/ux-v6.css')
    html = html.replace("../article.css", "/article.css")
    html = html.replace("src=\"assets/", "src=\"/assets/")
    html = html.replace("href=\"assets/", "href=\"/assets/")
    html = html.replace("src='assets/", "src='/assets/")
    html = html.replace("fetch('data/", "fetch('/data/")
    html = html.replace('fetch("data/', 'fetch("/data/')
    html = html.replace('href="feedback/"', 'href="/feedback/"')
    return html


def rewrite_text(text: str) -> str:
    protected: list[str] = []

    def stash(match: re.Match[str]) -> str:
        protected.append(match.group(0))
        return f"@@EXT{len(protected) - 1}@@"

    text = re.sub(r"https?://(?!burlingtonnews\.ca)[^\s\"'<>]+?\.html", stash, text)
    text = re.sub(
        r"(https://burlingtonnews\.ca)?/?articles/([a-z0-9][a-z0-9\-]*)\.html",
        r"/stories/\2/",
        text,
    )
    for old, new in PAGE_REPLACEMENTS:
        text = text.replace(old, new)
    for i, url in enumerate(protected):
        text = text.replace(f"@@EXT{i}@@", url)
    return text


def iter_rewrite_files() -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel in REWRITE_SKIP:
            continue
        if any(part in {".git", "node_modules"} for part in path.parts):
            continue
        if path.suffix not in REWRITE_SUFFIXES:
            continue
        out.append(path)
    return out


def write_redirects_json() -> None:
    mapping = []
    for old, dest in REDIRECTS:
        public_old = "/" + old.replace("index.html", "").lstrip("/")
        if not public_old.endswith("/") and not public_old.endswith(".html"):
            public_old += "/"
        if old.endswith("index.html"):
            public_old = "/" + str(Path(old).parent).replace("\\", "/") + "/"
        else:
            public_old = "/" + old
        mapping.append({"from": public_old, "to": dest, "file": old, "status": "308-or-html-stub"})
    extra_articles = []
    articles = ROOT / "articles"
    if articles.exists():
        for path in sorted(articles.rglob("*.html")):
            rel = path.relative_to(ROOT).as_posix()
            if rel in {old for old, _ in REDIRECTS}:
                continue
            dest = f"/stories/{path.stem}/"
            stub = path.read_text(encoding="utf-8", errors="replace")
            match = re.search(r"location\.replace\('([^']+)'\)", stub)
            if match:
                dest = match.group(1)
            extra_articles.append({
                "from": "/" + rel,
                "to": dest,
                "file": rel,
                "status": "308-or-html-stub",
            })
    payload = {
        "canonicalHost": ORIGIN + "/",
        "trailingSlash": True,
        "implementation": "GitHub Pages HTML stubs (canonical + refresh + location.replace). Prefer Cloudflare 308s from this map when available.",
        "keepUntil": "indefinitely; at least one year",
        "redirects": mapping,
        "articleRedirects": extra_articles,
    }
    (ROOT / "redirects.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def collect_canonical_urls() -> list[str]:
    urls = ["/"]
    skip_names = {"404.html"}
    stub_marker = 'meta name="robots" content="noindex,follow"'
    for path in sorted(ROOT.rglob("index.html")):
        if any(part in {".git", "node_modules", "articles"} for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if stub_marker in text or "location.replace(" in text and "This page has moved" in text:
            continue
        rel = path.parent.relative_to(ROOT).as_posix()
        urls.append("/" if rel == "." else f"/{rel}/")
    # Dedup, keep order
    seen = set()
    out = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def write_sitemap(urls: list[str]) -> None:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url in urls:
        loc = ORIGIN + url
        extra = f"<lastmod>{TODAY}</lastmod>" if url in {
            "/", "/news/", "/explore/", "/elections/", "/traffic/", "/sources/",
            "/accessibility/", "/about/", "/events/",
        } else ""
        lines.append(f"  <url><loc>{loc}</loc>{extra}</url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_events_hub() -> None:
    data = json.loads((ROOT / "data" / "explore-events.json").read_text(encoding="utf-8"))
    items = [event for event in data.get("events", []) if event.get("slug")]
    cards = []
    for event in items:
        slug = event["slug"]
        title = event.get("title") or slug
        when = event.get("dateLabel") or ""
        cards.append(
            f'<a class="authority-card" href="/events/{slug}/"><h3>{title}</h3>'
            f"<p>{when}</p></a>"
        )
    html = f"""<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Burlington events | Burlington News</title>
<meta name="description" content="Crawlable pages for notable Burlington events, with dates, venues and official sources. Filter the live calendar on Explore.">
<link rel="canonical" href="https://burlingtonnews.ca/events/">
<meta property="og:type" content="website">
<meta property="og:title" content="Burlington events">
<meta property="og:description" content="Notable Burlington events with dates, venues and official sources.">
<meta property="og:url" content="https://burlingtonnews.ca/events/">
<meta property="og:image" content="https://burlingtonnews.ca/assets/editorial/home-share.webp">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png">
<meta name="theme-color" content="#071b35">
<link rel="stylesheet" href="/site-extra.css?v=20260826seo">
<link rel="stylesheet" href="/site-bundle.css?v=20260824z4">
<link rel="stylesheet" href="/site-shell.css?v=20260824z5">
<link rel="stylesheet" href="/authority.css?v=20260826seo">
<script src="/site-extra.js?v=20260826seo" defer></script>
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"CollectionPage","name":"Burlington events","url":"https://burlingtonnews.ca/events/"}}</script>
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{{"@type":"ListItem","position":1,"name":"Home","item":"https://burlingtonnews.ca/"}},{{"@type":"ListItem","position":2,"name":"Explore","item":"https://burlingtonnews.ca/explore/"}},{{"@type":"ListItem","position":3,"name":"Events"}}]}}</script>
</head>
<body class="authority-page">
<a class="skip" href="#main">Skip to content</a>
<header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header>
<main id="main" class="authority-shell">
<nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="/">Home</a> /</li><li><a href="/explore/">Explore</a> /</li><li>Events</li></ol></nav>
<p class="authority-kicker">Explore</p>
<h1>Burlington events</h1>
<p class="authority-lead">These are the event pages Burlington News keeps crawlable. Month and category filters on Explore stay on Explore and do not create extra indexable URLs.</p>
<div class="authority-grid cols-2">
{"".join(cards)}
</div>
<p class="hub-links"><a href="/explore/">Explore calendar</a><a href="/explore/weekend/">This weekend</a></p>
</main>
</body>
</html>
"""
    dest = ROOT / "events" / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")


def main() -> None:
    for src, dest in MOVES:
        src_p = ROOT / src
        dest_p = ROOT / dest
        if not src_p.exists():
            print(f"SKIP missing {src}")
            continue
        dest_p.parent.mkdir(parents=True, exist_ok=True)
        if dest_p.exists() and dest_p.resolve() != src_p.resolve():
            print(f"DEST exists, stubbing {src} only")
            continue
        shutil.move(str(src_p), str(dest_p))
        html = dest_p.read_text(encoding="utf-8")
        html = rewrite_self_urls(html, canonical_for_dest(dest))
        html = fix_moved_assets(html)
        dest_p.write_text(html, encoding="utf-8")
        print(f"MOVED {src} -> {dest}")

    articles = ROOT / "articles"
    if articles.exists():
        for path in sorted(articles.rglob("*.html")):
            rel = path.relative_to(ROOT).as_posix()
            text = path.read_text(encoding="utf-8", errors="replace")
            match = re.search(r'canonical" href="(https://burlingtonnews\.ca[^"]+)"', text)
            if match:
                dest = match.group(1).replace(ORIGIN, "")
                if not dest.endswith("/"):
                    dest += "/"
            else:
                dest = f"/stories/{path.stem}/"
            write_stub(rel, dest)
            print(f"STUB {rel} -> {dest}")

    for old, dest in REDIRECTS:
        write_stub(old, dest)
        print(f"STUB {old} -> {dest}")

    write_events_hub()
    print("WROTE events/index.html")

    changed = 0
    for path in iter_rewrite_files():
        raw = path.read_text(encoding="utf-8", errors="replace")
        new = rewrite_text(raw)
        if path.suffix == ".html" and path.name == "index.html":
            new = fix_moved_assets(new)
        if new != raw:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(f"REWROTE {path.relative_to(ROOT)}")
    print(f"Rewrote {changed} files")

    write_redirects_json()
    write_sitemap(collect_canonical_urls())
    print("Wrote redirects.json and sitemap.xml")


if __name__ == "__main__":
    main()
