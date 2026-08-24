#!/usr/bin/env python3
"""Add candidate photos only when identity can be verified with high confidence.

Rules:
- The candidate name must already exist in the City-derived ballot data.
- Prefer the candidate-supplied website listed in ballot.json.
- An image from a candidate site is accepted only when the page contains the exact
  candidate name plus Burlington/election context and exposes a non-logo og:image.
- BurlingtonToday candidate profiles may be used only when the article title contains
  the exact candidate name and candidate/election language.
- Existing manually verified images are never replaced automatically.
- If identity cannot be verified, leave the initials placeholder. Do not guess.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BALLOT = ROOT / 'data' / 'ballot.json'
UA = 'BurlingtonElectionGuide/1.4 (+https://electionsburlington.ca/)'
BT_INDEX = 'https://www.burlingtontoday.com/2026-municipal-election-news'


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        ctype = r.headers.get('Content-Type', '')
        raw = r.read(2_000_000)
        return raw.decode(r.headers.get_content_charset() or 'utf-8', errors='replace'), ctype


def meta(body: str, key: str) -> str:
    patterns = [
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
    ]
    for pat in patterns:
        m = re.search(pat, body, re.I)
        if m:
            return html.unescape(m.group(1)).strip()
    return ''


def visible_text(body: str) -> str:
    body = re.sub(r'<script\b[^>]*>.*?</script>', ' ', body, flags=re.I | re.S)
    body = re.sub(r'<style\b[^>]*>.*?</style>', ' ', body, flags=re.I | re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', body))).strip()


def norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()


def valid_image_url(url: str, base: str) -> str:
    if not url:
        return ''
    url = urllib.parse.urljoin(base, url)
    low = url.lower()
    if any(x in low for x in ('favicon', 'logo.', '/logo', 'icon.', '/icon', 'sprite')):
        return ''
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': 'bytes=0-2047'})
        with urllib.request.urlopen(req, timeout=15) as r:
            if not r.headers.get('Content-Type', '').lower().startswith('image/'):
                return ''
    except Exception:
        return ''
    return url


class LinkParser(HTMLParser):
    def __init__(self, base: str):
        super().__init__(); self.base = base; self.current = None; self.bits = []; self.links = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            href = dict(attrs).get('href')
            if href:
                self.current = urllib.parse.urljoin(self.base, href); self.bits = []
    def handle_data(self, data):
        if self.current: self.bits.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == 'a' and self.current:
            label = re.sub(r'\s+', ' ', ' '.join(self.bits)).strip()
            if label: self.links.append((label, self.current))
            self.current = None; self.bits = []


def all_candidates(data: dict) -> list[str]:
    out = list(data.get('mayor', []))
    for w in data.get('wards', {}).values():
        out += w.get('councillor', []) + w.get('publicTrustee', []) + w.get('catholicTrustee', [])
    out += data.get('frenchPublicTrustee', []) + data.get('frenchCatholicTrustee', [])
    return list(dict.fromkeys(out))


def from_candidate_site(name: str, url: str) -> dict | None:
    try:
        body, _ = fetch(url)
    except Exception:
        return None
    text = norm(visible_text(body)[:120000])
    if norm(name) not in text:
        return None
    if not any(k in text for k in ('burlington', 'candidate', 'council', 'councillor', 'mayor', 'trustee', 'ward')):
        return None
    image = valid_image_url(meta(body, 'og:image'), url)
    if not image:
        return None
    return {'url': image, 'source': 'Candidate website', 'sourceUrl': url, 'verifiedAt': dt.date.today().isoformat(), 'match': 'high'}


def burlington_today_candidates(names: list[str]) -> dict[str, dict]:
    try:
        body, _ = fetch(BT_INDEX)
    except Exception:
        return {}
    p = LinkParser(BT_INDEX); p.feed(body)
    results: dict[str, dict] = {}
    for name in names:
        n = norm(name)
        for label, url in p.links:
            label_n = norm(label)
            if n not in label_n:
                continue
            if not any(k in label_n for k in ('candidate', 'seeks', 'running', 'vying', 'mayor', 'ward', 'trustee')):
                continue
            try:
                article, _ = fetch(url)
            except Exception:
                continue
            title = meta(article, 'og:title') or meta(article, 'twitter:title') or label
            if n not in norm(title):
                continue
            image = valid_image_url(meta(article, 'og:image'), url)
            if image:
                results[name] = {'url': image, 'source': 'BurlingtonToday', 'sourceUrl': url, 'verifiedAt': dt.date.today().isoformat(), 'match': 'high'}
                break
    return results


def main():
    data = json.loads(BALLOT.read_text(encoding='utf-8'))
    images = data.setdefault('candidateImages', {})
    names = all_candidates(data)

    for name in names:
        if name in images:
            continue
        site = data.get('candidateWebsites', {}).get(name)
        if site:
            found = from_candidate_site(name, site)
            if found:
                images[name] = found

    missing = [n for n in names if n not in images]
    for name, record in burlington_today_candidates(missing).items():
        images.setdefault(name, record)

    data['candidateImagesLastChecked'] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    BALLOT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
