#!/usr/bin/env python3
"""Keep Burlington News story URLs, metadata and sitemaps search-engine clean.

The site is static GitHub Pages. `/stories/<slug>/` is the only indexable story
URL. Legacy `/articles/...html` files remain as source files, but are marked
noindex and immediately redirect in the browser to the canonical story URL.
"""
from __future__ import annotations

import datetime as dt
import html as html_lib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://burlingtonnews.ca"
LOGO = f"{BASE}/assets/brand/android-chrome-512x512.png"
STORIES = ROOT / "stories"
ARTICLES = ROOT / "articles"

STATIC_CANONICAL_PATHS = [
    "/",
    "/news/",
    "/explore/",
    "/explore/weekend/",
    "/elections/",
    "/elections/compare/",
    "/elections/ward/",
    "/traffic/",
    "/go/",
    "/go/burlington-to-union/",
    "/go/which-station/",
    "/development/",
    "/taxes/",
    "/parking/",
    "/beach/",
    "/safety/",
    "/food/",
    "/sports/",
    "/about/",
    "/editorial-standards/",
    "/corrections/",
    "/ai-policy/",
    "/methodology.html",
    "/help.html",
    "/feedback/",
    "/work-with-us/",
    "/privacy.html",
    "/terms.html",
    "/head-to-head.html",
    "/ballot.html",
    "/food-passport/",
    "/guides/best-of-burlington.html",
]

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def escape_attr(value: str) -> str:
    return html_lib.escape(str(value), quote=True)


def strip_tags(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html_lib.unescape(value)).strip()


def insert_before_head_close(doc: str, tag: str) -> str:
    if re.search(r"</head>", doc, re.I):
        return re.sub(r"</head>", tag + "\n</head>", doc, count=1, flags=re.I)
    return doc


def upsert_meta(doc: str, attr: str, key: str, content: str, extra: str = "") -> str:
    pattern = re.compile(
        rf"<meta\b(?=[^>]*\b{re.escape(attr)}=[\"']{re.escape(key)}[\"'])[^>]*>",
        re.I,
    )
    tag = f'<meta {attr}="{escape_attr(key)}" content="{escape_attr(content)}"{extra}>'
    if pattern.search(doc):
        return pattern.sub(tag, doc, count=1)
    return insert_before_head_close(doc, tag)


def remove_meta(doc: str, attr: str, key: str) -> str:
    pattern = re.compile(
        rf"\s*<meta\b(?=[^>]*\b{re.escape(attr)}=[\"']{re.escape(key)}[\"'])[^>]*>",
        re.I,
    )
    return pattern.sub("", doc)


def upsert_canonical(doc: str, canonical: str) -> str:
    pattern = re.compile(r"<link\b(?=[^>]*\brel=[\"']canonical[\"'])[^>]*>", re.I)
    tag = f'<link rel="canonical" href="{escape_attr(canonical)}">'
    if pattern.search(doc):
        return pattern.sub(tag, doc, count=1)
    return insert_before_head_close(doc, tag)


def get_meta(doc: str, attr: str, key: str) -> str:
    tag_match = re.search(
        rf"<meta\b(?=[^>]*\b{re.escape(attr)}=[\"']{re.escape(key)}[\"'])[^>]*>",
        doc,
        re.I,
    )
    if not tag_match:
        return ""
    content = re.search(r"\bcontent=[\"']([^\"']*)[\"']", tag_match.group(0), re.I)
    return html_lib.unescape(content.group(1)).strip() if content else ""


def get_canonical(doc: str) -> str:
    tag_match = re.search(r"<link\b(?=[^>]*\brel=[\"']canonical[\"'])[^>]*>", doc, re.I)
    if not tag_match:
        return ""
    href = re.search(r"\bhref=[\"']([^\"']+)[\"']", tag_match.group(0), re.I)
    return html_lib.unescape(href.group(1)).strip() if href else ""


def first_h1(doc: str) -> str:
    match = re.search(r"<h1\b[^>]*>(.*?)</h1>", doc, re.I | re.S)
    return strip_tags(match.group(1)) if match else ""


def page_title(doc: str) -> str:
    match = re.search(r"<title\b[^>]*>(.*?)</title>", doc, re.I | re.S)
    value = strip_tags(match.group(1)) if match else ""
    return re.sub(r"\s*\|\s*Burlington News\s*$", "", value, flags=re.I).strip()


def hero_image(doc: str) -> str:
    image = get_meta(doc, "property", "og:image")
    if image:
        return image if image.startswith("http") else BASE + "/" + image.lstrip("/")
    match = re.search(r"<figure\b[^>]*class=[\"'][^\"']*article-hero[^\"']*[\"'][^>]*>.*?<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", doc, re.I | re.S)
    if not match:
        return f"{BASE}/assets/editorial/home-share.webp"
    src = html_lib.unescape(match.group(1)).strip()
    if src.startswith("http"):
        return src
    if src.startswith("../"):
        src = "/" + src[3:]
    return BASE + "/" + src.lstrip("/")


def is_redirect_page(doc: str) -> bool:
    robots = get_meta(doc, "name", "robots").lower()
    return (
        "noindex" in robots
        and (
            re.search(r"<meta\b[^>]*http-equiv=[\"']refresh[\"']", doc, re.I) is not None
            or "location.replace(" in doc
            or "story has moved" in doc.lower()
        )
    )


def existing_news_schema(doc: str) -> dict:
    for match in re.finditer(r"<script\b[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", doc, re.I | re.S):
        raw = match.group(1).strip()
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        candidates = []
        if isinstance(payload, dict):
            candidates.append(payload)
            graph = payload.get("@graph")
            if isinstance(graph, list):
                candidates.extend(node for node in graph if isinstance(node, dict))
        elif isinstance(payload, list):
            candidates.extend(node for node in payload if isinstance(node, dict))
        for node in candidates:
            kinds = node.get("@type")
            if kinds == "NewsArticle" or (isinstance(kinds, list) and "NewsArticle" in kinds):
                return node
    return {}


def replace_news_schema(doc: str, schema: dict) -> str:
    replacement = '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False, separators=(",", ":")) + "</script>"
    pattern = re.compile(r"<script\b[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", re.I | re.S)
    for match in pattern.finditer(doc):
        if "NewsArticle" in match.group(1):
            return doc[:match.start()] + replacement + doc[match.end():]
    return insert_before_head_close(doc, replacement)


def normalize_iso_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$", value)
    if match:
        return value if "T" in value else match.group(1)
    return ""


def parse_human_date(doc: str) -> str:
    text = strip_tags(doc)
    pattern = re.compile(
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+"
        r"(\d{1,2}),\s+(20\d{2})\b",
        re.I,
    )
    match = pattern.search(text)
    if not match:
        return ""
    month_key = match.group(1).lower().rstrip(".")
    month = MONTHS.get(month_key)
    if not month:
        return ""
    try:
        parsed = dt.date(int(match.group(3)), month, int(match.group(2)))
    except ValueError:
        return ""
    return parsed.isoformat()


def load_date_hints() -> dict[str, str]:
    hints: dict[str, str] = {}

    def record(url: str, value: str) -> None:
        if not url or not value:
            return
        normalized = normalize_iso_date(str(value))
        if not normalized:
            return
        hints[url] = normalized
        if url.startswith("/articles/"):
            slug = Path(url).stem
            hints[f"/stories/{slug}/"] = normalized

    catalog = read_json(ROOT / "data" / "story-catalog.json", {})
    for item in catalog.get("stories", catalog.get("items", [])) if isinstance(catalog, dict) else []:
        if isinstance(item, dict):
            record(str(item.get("url") or ""), str(item.get("publishedAt") or item.get("datePublished") or item.get("published") or ""))

    breaking = read_json(ROOT / "data" / "breaking-archive.json", {})
    for item in breaking.get("items", []) if isinstance(breaking, dict) else []:
        if isinstance(item, dict):
            record(str(item.get("url") or ""), str(item.get("publishedAt") or item.get("datePublished") or ""))

    auto = read_json(ROOT / "data" / "auto-published.json", {})
    for item in auto.get("items", []) if isinstance(auto, dict) else []:
        if isinstance(item, dict):
            record(str(item.get("path") or ""), str(item.get("date") or ""))

    manual = read_json(ROOT / "data" / "manual-stories.json", {})
    rows = manual.get("stories", manual.get("items", [])) if isinstance(manual, dict) else []
    for item in rows:
        if isinstance(item, dict):
            record(str(item.get("url") or ""), str(item.get("publishedAt") or item.get("datePublished") or item.get("published") or ""))

    return hints


def published_date(doc: str, canonical_path: str, hints: dict[str, str]) -> str:
    schema = existing_news_schema(doc)
    for value in (
        str(schema.get("datePublished") or ""),
        get_meta(doc, "property", "article:published_time"),
        hints.get(canonical_path, ""),
        parse_human_date(doc),
    ):
        normalized = normalize_iso_date(value)
        if normalized:
            return normalized
    slug = canonical_path.strip("/").split("/")[-1]
    match = re.match(r"^(20\d{2}-\d{2}-\d{2})-", slug)
    return match.group(1) if match else ""


def modified_date(doc: str, published: str) -> str:
    schema = existing_news_schema(doc)
    for value in (
        str(schema.get("dateModified") or ""),
        get_meta(doc, "property", "article:modified_time"),
        published,
    ):
        normalized = normalize_iso_date(value)
        if normalized:
            return normalized
    return published


def story_description(doc: str) -> str:
    value = get_meta(doc, "name", "description")
    if value:
        return value
    for cls in ("article-deck", "dek"):
        match = re.search(rf"<p\b[^>]*class=[\"'][^\"']*{cls}[^\"']*[\"'][^>]*>(.*?)</p>", doc, re.I | re.S)
        if match:
            value = strip_tags(match.group(1))
            if value:
                return value
    return "Local reporting from Burlington News."


def remove_source_only_redirects(doc: str) -> str:
    doc = re.sub(r"\s*<meta\b[^>]*data-legacy-source-redirect[^>]*>", "", doc, flags=re.I)
    doc = re.sub(r"\s*<script\b[^>]*data-legacy-source-redirect[^>]*>.*?</script>", "", doc, flags=re.I | re.S)
    return doc


def normalize_story(path: Path, hints: dict[str, str]) -> tuple[bool, str]:
    doc = path.read_text(encoding="utf-8")
    if is_redirect_page(doc):
        return False, doc

    slug = path.parent.name
    canonical_path = f"/stories/{slug}/"
    canonical = BASE + canonical_path
    doc = remove_source_only_redirects(doc)
    doc = remove_meta(doc, "name", "robots")
    doc = upsert_canonical(doc, canonical)
    doc = upsert_meta(doc, "property", "og:url", canonical)
    doc = upsert_meta(doc, "name", "author", "Burlington News")

    headline = first_h1(doc) or page_title(doc) or "Burlington News"
    description = story_description(doc)
    published = published_date(doc, canonical_path, hints)
    modified = modified_date(doc, published)
    image = hero_image(doc)

    if published:
        doc = upsert_meta(doc, "property", "article:published_time", published)
    if modified:
        doc = upsert_meta(doc, "property", "article:modified_time", modified)

    schema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": headline,
        "description": description,
        "author": {"@type": "Organization", "name": "Burlington News", "url": f"{BASE}/about/"},
        "publisher": {
            "@type": "Organization",
            "name": "Burlington News",
            "url": f"{BASE}/",
            "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512},
        },
        "image": [image],
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "isAccessibleForFree": True,
    }
    if published:
        schema["datePublished"] = published
    if modified:
        schema["dateModified"] = modified
    doc = replace_news_schema(doc, schema)
    return True, doc


def add_legacy_redirect(path: Path) -> None:
    doc = path.read_text(encoding="utf-8")
    stem = path.stem
    current_canonical = get_canonical(doc)
    intentional_redirect = is_redirect_page(doc) and current_canonical and not current_canonical.endswith(f"/stories/{stem}/")
    if intentional_redirect:
        return

    target_path = f"/stories/{stem}/"
    target = BASE + target_path
    doc = upsert_canonical(doc, target)
    doc = upsert_meta(doc, "name", "robots", "noindex,follow", " data-legacy-source-redirect=\"true\"")

    refresh_pattern = re.compile(r"<meta\b[^>]*data-legacy-source-redirect[^>]*http-equiv=[\"']refresh[\"'][^>]*>", re.I)
    refresh = f'<meta http-equiv="refresh" content="0; url={escape_attr(target_path)}" data-legacy-source-redirect="true">'
    if refresh_pattern.search(doc):
        doc = refresh_pattern.sub(refresh, doc, count=1)
    else:
        doc = insert_before_head_close(doc, refresh)

    script_pattern = re.compile(r"<script\b[^>]*data-legacy-source-redirect[^>]*>.*?</script>", re.I | re.S)
    script = '<script data-legacy-source-redirect="true">location.replace(' + json.dumps(target_path) + ');</script>'
    if script_pattern.search(doc):
        doc = script_pattern.sub(script, doc, count=1)
    else:
        doc = insert_before_head_close(doc, script)

    path.write_text(doc, encoding="utf-8")


def story_records(hints: dict[str, str]) -> list[dict]:
    records = []
    for path in sorted(STORIES.glob("*/index.html")):
        doc = path.read_text(encoding="utf-8")
        if is_redirect_page(doc) or "noindex" in get_meta(doc, "name", "robots").lower():
            continue
        slug = path.parent.name
        canonical_path = f"/stories/{slug}/"
        canonical = get_canonical(doc)
        if canonical != BASE + canonical_path:
            continue
        title = first_h1(doc) or page_title(doc)
        pub = published_date(doc, canonical_path, hints)
        mod = modified_date(doc, pub)
        records.append({"path": canonical_path, "title": title, "published": pub, "modified": mod})
    return records


def xml_urlset(records: list[dict]) -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for row in records:
        loc = html_lib.escape(BASE + row["path"], quote=False)
        if row.get("lastmod"):
            lastmod = html_lib.escape(str(row["lastmod"]).split("T", 1)[0], quote=False)
            lines.append(f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>")
        else:
            lines.append(f"  <url><loc>{loc}</loc></url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def build_sitemap(stories: list[dict]) -> None:
    rows = [{"path": path} for path in STATIC_CANONICAL_PATHS]
    rows.extend({"path": row["path"], "lastmod": row.get("modified") or row.get("published")} for row in stories)
    for event in sorted((ROOT / "events").glob("*/index.html")):
        rows.append({"path": f"/events/{event.parent.name}/"})
    seen = set()
    unique = []
    for row in rows:
        if row["path"] in seen:
            continue
        seen.add(row["path"])
        unique.append(row)
    (ROOT / "sitemap.xml").write_text(xml_urlset(unique), encoding="utf-8")


def date_part(value: str) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value[:10])
    except ValueError:
        return None


def build_news_sitemap(stories: list[dict]) -> None:
    today = dt.datetime.now(dt.timezone.utc).date()
    cutoff = today - dt.timedelta(days=2)
    current = [row for row in stories if (date_part(row.get("published", "")) or dt.date.min) >= cutoff]
    current.sort(key=lambda row: row.get("published", ""), reverse=True)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ]
    for row in current:
        title = html_lib.escape(row["title"], quote=False)
        published = html_lib.escape(row["published"], quote=False)
        loc = html_lib.escape(BASE + row["path"], quote=False)
        lines.extend([
            "  <url>",
            f"    <loc>{loc}</loc>",
            "    <news:news>",
            "      <news:publication><news:name>Burlington News</news:name><news:language>en</news:language></news:publication>",
            f"      <news:publication_date>{published}</news:publication_date>",
            f"      <news:title>{title}</news:title>",
            "    </news:news>",
            "  </url>",
        ])
    lines.append("</urlset>")
    (ROOT / "news-sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def validate(stories: list[dict]) -> list[str]:
    errors = []
    for path in sorted(STORIES.glob("*/index.html")):
        doc = path.read_text(encoding="utf-8")
        if is_redirect_page(doc):
            continue
        slug = path.parent.name
        canonical = BASE + f"/stories/{slug}/"
        if get_canonical(doc) != canonical:
            errors.append(f"{path.relative_to(ROOT)}: canonical is not self-referencing")
        if "noindex" in get_meta(doc, "name", "robots").lower():
            errors.append(f"{path.relative_to(ROOT)}: real story is noindex")
        schema = existing_news_schema(doc)
        if not schema:
            errors.append(f"{path.relative_to(ROOT)}: missing NewsArticle schema")
            continue
        publisher = schema.get("publisher") if isinstance(schema.get("publisher"), dict) else {}
        logo = publisher.get("logo") if isinstance(publisher.get("logo"), dict) else {}
        author = schema.get("author") if isinstance(schema.get("author"), dict) else {}
        if publisher.get("name") != "Burlington News" or logo.get("url") != LOGO:
            errors.append(f"{path.relative_to(ROOT)}: publisher/logo metadata incomplete")
        if author.get("name") != "Burlington News":
            errors.append(f"{path.relative_to(ROOT)}: author metadata incomplete")
        if not schema.get("datePublished"):
            errors.append(f"{path.relative_to(ROOT)}: missing datePublished")
        if "article-body" not in doc:
            errors.append(f"{path.relative_to(ROOT)}: important article content is not present in static HTML")

    for path in sorted(ARTICLES.glob("*.html")) + sorted((ARTICLES / "auto").glob("*.html")):
        doc = path.read_text(encoding="utf-8")
        if is_redirect_page(doc) and not re.search(r"data-legacy-source-redirect", doc, re.I):
            continue
        robots = get_meta(doc, "name", "robots").lower()
        if "noindex" not in robots:
            errors.append(f"{path.relative_to(ROOT)}: legacy article source is indexable")
        if "/stories/" not in get_canonical(doc):
            errors.append(f"{path.relative_to(ROOT)}: legacy article canonical does not point to /stories/")
        if "data-legacy-source-redirect" not in doc:
            errors.append(f"{path.relative_to(ROOT)}: legacy article lacks browser redirect")

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    news_sitemap = (ROOT / "news-sitemap.xml").read_text(encoding="utf-8")
    if "/articles/" in sitemap or "/articles/" in news_sitemap:
        errors.append("A sitemap contains a legacy /articles/ URL")

    try:
        ET.fromstring(sitemap)
        ET.fromstring(news_sitemap)
    except ET.ParseError as exc:
        errors.append(f"Sitemap XML parse error: {exc}")

    if not stories:
        errors.append("No indexable story records found")
    return errors


def main() -> int:
    hints = load_date_hints()
    normalized = 0
    skipped = 0
    for path in sorted(STORIES.glob("*/index.html")):
        real, doc = normalize_story(path, hints)
        if real:
            path.write_text(doc, encoding="utf-8")
            normalized += 1
        else:
            skipped += 1

    for path in sorted(ARTICLES.glob("*.html")) + sorted((ARTICLES / "auto").glob("*.html")):
        add_legacy_redirect(path)

    records = story_records(hints)
    build_sitemap(records)
    build_news_sitemap(records)
    errors = validate(records)
    if errors:
        print("Search indexing hygiene failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Search indexing hygiene OK: {normalized} stories normalized, {skipped} redirect pages skipped, {len(records)} stories indexed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
