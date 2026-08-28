#!/usr/bin/env python3
"""Apply durable editorial presentation overrides to published story HTML.

The catalogue remains the source of story eligibility/scoring. story-overrides.json is
where editors can replace weak/generated hero art and clean up display headlines/decks.
This pass applies those overrides to both source article files and public /stories/ URLs
so an hourly sync cannot put an SVG/diagram back into the primary hero slot.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "story-catalog.json"
OVERRIDES = ROOT / "data" / "story-overrides.json"


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


def source_paths(item: dict) -> list[Path]:
    url = str(item.get("url") or "")
    match = re.search(r"articles/([^/]+)\.html$", url)
    if not match:
        return []
    slug = match.group(1)
    paths = [ROOT / "articles" / f"{slug}.html", ROOT / "stories" / slug / "index.html"]
    return [path for path in paths if path.exists()]


def replace_meta(content: str, key: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    pattern = rf'(<meta\s+(?:property|name)="{re.escape(key)}"\s+content=")[^"]*(")'
    return re.sub(pattern, rf'\g<1>{escaped}\2', content, count=1, flags=re.I)


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


def main() -> int:
    catalogue = load_json(CATALOG, {"items": []})
    overrides = load_json(OVERRIDES, {})
    by_id = {str(item.get("id") or ""): item for item in catalogue.get("items", [])}
    changed = 0
    for story_id, patch in overrides.items():
        item = by_id.get(story_id)
        if not item:
            continue
        for path in source_paths(item):
            original = path.read_text(encoding="utf-8")
            updated, did_change = apply_patch(original, patch)
            if did_change:
                path.write_text(updated, encoding="utf-8")
                changed += 1
                print(f"updated {path.relative_to(ROOT)}")
    print(f"Applied presentation overrides to {changed} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
