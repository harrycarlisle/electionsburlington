#!/usr/bin/env python3
"""Apply durable Burlington News article presentation rules.

This pass keeps editorial scoring in story-catalog.json, applies explicit headline/image
overrides, then normalizes every published article to the publication layout:
category -> headline -> deck -> hero -> byline/date/read time -> topics -> body.
Supporting diagrams are preserved only as supporting media and moved to the section
where they actually help the reader instead of appearing immediately after the hero.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "story-catalog.json"
OVERRIDES = ROOT / "data" / "story-overrides.json"
PUBLICATION_CSS = "/article-publication-layout.css?v=20260828article1"

# A graphic should appear after the paragraph that makes it useful, not after the
# first paragraph simply because it used to be the hero image.
SUPPORTING_AFTER = {
    "burlington-flood-protection-90-million": "That is why “$90 million spent” does not mean Burlington's flood work is finished.",
    "costco-burloak-wyecroft": "Two more access points are proposed from RioCan Boulevard",
    "sekisui-burlington-modular-factory": "The modules are then transported to a construction site and connected into the final building.",
    "burlington-road-closures-september-2026": "Spruce Avenue is closed between Shoreacres Road and Goodram Drive through Sept. 4.",
}


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def asset_path(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("http") or raw.startswith("/"):
        return raw
    return f"/{raw}"


def absolute_asset(value: str) -> str:
    return value if value.startswith("http") else f"https://burlingtonnews.ca{value}"


def slug_from_path(path: Path) -> str:
    if path.parent.name == "auto":
        return path.stem
    if path.name == "index.html" and path.parent.parent.name == "stories":
        return path.parent.name
    return path.stem


def source_paths(item: dict) -> list[Path]:
    url = str(item.get("url") or "")
    match = re.search(r"articles/(?:auto/)?([^/]+)\.html$", url)
    if not match:
        return []
    slug = match.group(1)
    candidates = [
        ROOT / "articles" / f"{slug}.html",
        ROOT / "articles" / "auto" / f"{slug}.html",
        ROOT / "stories" / slug / "index.html",
    ]
    return [path for path in candidates if path.exists()]


def replace_meta(content: str, key: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    pattern = rf'(<meta\s+(?:property|name)="{re.escape(key)}"\s+content=")[^"]*(")'
    return re.sub(pattern, rf'\g<1>{escaped}\2', content, count=1, flags=re.I)


def ensure_stylesheet(content: str, href: str) -> str:
    base = href.split("?")[0]
    if base in content:
        return content
    return content.replace("</head>", f'<link rel="stylesheet" href="{href}">\n</head>', 1)


def supporting_graphic(old_figure: str, old_src: str, old_alt: str) -> str:
    caption_match = re.search(r"<figcaption>(.*?)</figcaption>", old_figure, re.I | re.S)
    caption = re.sub(r"<[^>]+>", "", caption_match.group(1)).strip() if caption_match else "Supporting graphic: Burlington News."
    return (
        '<figure class="article-inline-image article-supporting-graphic" data-supporting-graphic="original-hero">'
        f'<img src="{html.escape(old_src, quote=True)}" alt="{html.escape(old_alt, quote=True)}" loading="lazy">'
        f'<figcaption>{html.escape(caption)}</figcaption></figure>'
    )


def insert_supporting_graphic(content: str, figure: str) -> str:
    if 'data-supporting-graphic="original-hero"' in content:
        return content
    body_match = re.search(r'(<article\s+class="article-body"[^>]*>)(.*)', content, re.I | re.S)
    if not body_match:
        return content
    start = body_match.end(1)
    tail = content[start:]
    first_para = re.search(r"</p>", tail, re.I)
    insert_at = start + (first_para.end() if first_para else 0)
    return content[:insert_at] + figure + content[insert_at:]


def move_supporting_graphic(content: str, story_id: str) -> str:
    needle = SUPPORTING_AFTER.get(story_id)
    if not needle:
        return content
    figure_match = re.search(
        r'<figure\s+class="[^"]*article-supporting-graphic[^"]*"[^>]*data-supporting-graphic="original-hero"[^>]*>.*?</figure>',
        content,
        re.I | re.S,
    )
    if not figure_match:
        return content
    figure = figure_match.group(0)
    without = content[:figure_match.start()] + content[figure_match.end():]
    # Match the paragraph by a stable text fragment while tolerating inline markup.
    paras = list(re.finditer(r'<p\b[^>]*>.*?</p>', without, re.I | re.S))
    target = None
    needle_plain = re.sub(r"\s+", " ", needle).strip().lower()
    for para in paras:
        plain = re.sub(r"<[^>]+>", "", para.group(0))
        plain = html.unescape(re.sub(r"\s+", " ", plain)).strip().lower()
        if needle_plain in plain:
            target = para
            break
    if not target:
        return content
    return without[:target.end()] + "\n" + figure + without[target.end():]


def apply_patch(content: str, patch: dict) -> tuple[str, bool]:
    before = content
    headline = str(patch.get("headline") or "").strip()
    deck = str(patch.get("deck") or "").strip()
    image = asset_path(patch.get("image"))
    alt = str(patch.get("alt") or headline or "Burlington News").strip()
    credit = str(patch.get("credit") or "Burlington News visual").strip()

    if '<link rel="stylesheet" href="/precision-pass.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/precision-pass.css?v=20260828precision1">\n</head>', 1)

    if headline:
        content = re.sub(r"<title>.*?</title>", f"<title>{html.escape(headline)} | Burlington News</title>", content, count=1, flags=re.I | re.S)
        content = re.sub(r'(<header\s+class="article-head"[^>]*>.*?<h1>).*?(</h1>)', rf'\g<1>{html.escape(headline)}\2', content, count=1, flags=re.I | re.S)
        content = replace_meta(content, "og:title", headline)
        content = re.sub(r'("headline"\s*:\s*")[^"]*(")', lambda m: f'{m.group(1)}{headline.replace(chr(34), chr(39))}{m.group(2)}', content, count=1)

    if deck:
        content = re.sub(r'(<p\s+class="article-deck"[^>]*>).*?(</p>)', rf'\g<1>{html.escape(deck)}\2', content, count=1, flags=re.I | re.S)
        content = replace_meta(content, "og:description", deck)

    if image:
        hero = re.search(r'<figure\s+class="article-hero[^"]*"[^>]*>.*?</figure>', content, re.I | re.S)
        if hero:
            old_figure = hero.group(0)
            old_src_match = re.search(r'<img[^>]+src="([^"]+)"', old_figure, re.I)
            old_alt_match = re.search(r'<img[^>]+alt="([^"]*)"', old_figure, re.I)
            old_src = old_src_match.group(1) if old_src_match else ""
            old_alt = old_alt_match.group(1) if old_alt_match else "Supporting Burlington News graphic."
            descriptor = f"{old_src} {old_alt} {old_figure}".lower()
            graphic_like = old_src.lower().endswith('.svg') or any(word in descriptor for word in ('diagram', 'graphic', 'timeline', 'schematic', 'orientation map'))
            if graphic_like and old_src and old_src != image:
                content = insert_supporting_graphic(content, supporting_graphic(old_figure, old_src, old_alt))
            replacement = (
                '<figure class="article-hero">\n'
                f'<img src="{html.escape(image, quote=True)}" alt="{html.escape(alt, quote=True)}" fetchpriority="high">\n'
                f'<figcaption>{html.escape(credit)}</figcaption>\n'
                '</figure>'
            )
            content = content[:hero.start()] + replacement + content[hero.end():]
        content = replace_meta(content, "og:image", absolute_asset(image))
        content = replace_meta(content, "twitter:image", absolute_asset(image))
        content = re.sub(r'("image"\s*:\s*")(https?://[^"\\]+|/[^"\\]+)(")', rf'\g<1>{absolute_asset(image)}\3', content, count=1)

    return content, content != before


def nice_topic(value: str) -> str:
    value = re.sub(r"[-_]+", " ", str(value or "").strip())
    special = {"go": "GO", "qew": "QEW", "ai": "AI", "hdsb": "HDSB"}
    words = [special.get(word.lower(), word.capitalize()) for word in value.split()]
    return " ".join(words)


def topic_values(item: dict, content: str) -> list[str]:
    values: list[str] = []
    for raw in [item.get("topic"), *(item.get("subjects") or [])]:
        label = nice_topic(str(raw or ""))
        if label and label.lower() not in {x.lower() for x in values}:
            values.append(label)
        if len(values) >= 4:
            break
    if not values:
        kicker = re.search(r'<div\s+class="article-kicker"[^>]*>(.*?)</div>', content, re.I | re.S)
        if kicker:
            label = nice_topic(re.sub(r"<[^>]+>", "", kicker.group(1)))
            if label:
                values.append(label)
    return values[:4]


def topics_markup(item: dict, content: str) -> str:
    values = topic_values(item, content)
    if not values:
        return ""
    links = []
    for label in values:
        slug = quote(label.lower().replace(" ", "-"), safe="-")
        links.append(f'<a href="/news/?topic={slug}">{html.escape(label)}</a>')
    return '<div class="article-topics"><span>Topics:</span>' + '<span class="article-topic-sep">/</span>'.join(links) + '</div>'


def normalize_article_structure(content: str, item: dict) -> str:
    content = ensure_stylesheet(content, PUBLICATION_CSS)
    hero = re.search(r'<figure\s+class="article-hero[^"]*"[^>]*>.*?</figure>', content, re.I | re.S)
    if not hero:
        return content

    byline_match = re.search(r'<div\s+class="article-byline"[^>]*>.*?</div>', content, re.I | re.S)
    byline = byline_match.group(0) if byline_match else ""

    # Remove any existing normalized metadata wrapper first, then remove the old
    # byline wherever a legacy template placed it (usually above the hero).
    content = re.sub(
        r'<div\s+class="article-post-hero-meta"[^>]*>\s*(?:<div\s+class="article-byline"[^>]*>.*?</div>)?\s*(?:<div\s+class="article-topics"[^>]*>.*?</div>)?\s*</div>',
        '',
        content,
        flags=re.I | re.S,
    )
    content = re.sub(r'<div\s+class="article-byline"[^>]*>.*?</div>', '', content, flags=re.I | re.S)

    # Re-find the hero after the removals so indices are correct.
    hero = re.search(r'<figure\s+class="article-hero[^"]*"[^>]*>.*?</figure>', content, re.I | re.S)
    if not hero:
        return content
    topics = topics_markup(item, content)
    if byline or topics:
        meta = '<div class="article-post-hero-meta">' + byline + topics + '</div>'
        content = content[:hero.end()] + "\n" + meta + content[hero.end():]
    return content


def item_for_slug(items: list[dict], slug: str) -> dict:
    for item in items:
        url = str(item.get("url") or "")
        if item.get("id") == slug or re.search(rf'/{re.escape(slug)}\.html$', url):
            return item
    return {}


def all_article_paths() -> list[Path]:
    paths = list((ROOT / "articles").glob("*.html"))
    paths += list((ROOT / "articles" / "auto").glob("*.html"))
    for story in (ROOT / "stories").glob("*/index.html"):
        paths.append(story)
    return sorted(set(paths))


def main() -> int:
    catalogue = load_json(CATALOG, {"items": []})
    items = catalogue.get("items", [])
    overrides = load_json(OVERRIDES, {})
    by_id = {str(item.get("id") or ""): item for item in items}
    changed_paths: set[Path] = set()

    # First apply explicit editorial headline/image choices.
    for story_id, patch in overrides.items():
        item = by_id.get(story_id)
        if not item:
            continue
        for path in source_paths(item):
            original = path.read_text(encoding="utf-8")
            updated, _ = apply_patch(original, patch)
            updated = move_supporting_graphic(updated, story_id)
            updated = normalize_article_structure(updated, item)
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                changed_paths.add(path)

    # Then normalize every other published article, including short breaking briefs.
    for path in all_article_paths():
        original = path.read_text(encoding="utf-8")
        slug = slug_from_path(path)
        item = item_for_slug(items, slug)
        updated = move_supporting_graphic(original, slug)
        updated = normalize_article_structure(updated, item)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed_paths.add(path)

    for path in sorted(changed_paths):
        print(f"updated {path.relative_to(ROOT)}")
    print(f"Applied article presentation rules to {len(changed_paths)} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
