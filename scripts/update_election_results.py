#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'election-results.json'
URL = 'https://myvote.burlington.ca/results/'
UA = {'User-Agent': 'BurlingtonNews/2.0 (+https://burlingtonnews.ca/)'}
CANDIDATES = ['Keith Demoe','Lisa Kearns','Marianne Meed Ward','Rory Nisan','Yugalkeesor Ramdhonee']


def fetch() -> str:
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode(r.headers.get_content_charset() or 'utf-8', errors='replace')


def text_only(body: str) -> str:
    body = re.sub(r'<script\b[^>]*>.*?</script>', ' ', body, flags=re.I|re.S)
    body = re.sub(r'<style\b[^>]*>.*?</style>', ' ', body, flags=re.I|re.S)
    body = re.sub(r'<[^>]+>', ' ', body)
    return re.sub(r'\s+', ' ', html.unescape(body)).strip()


def find_votes(text: str, name: str):
    # Results providers change markup between elections. Keep this intentionally conservative:
    # only accept a nearby integer if the exact candidate name appears first.
    pos = text.lower().find(name.lower())
    if pos < 0:
        return None
    sample = text[pos:pos+220]
    nums = re.findall(r'(?<![\d.])([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{1,6})(?![\d.])', sample)
    for raw in nums:
        n = int(raw.replace(',', ''))
        if n >= 0:
            return n
    return None


def main():
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    existing = json.loads(OUT.read_text()) if OUT.exists() else {'display': False, 'mayor': []}
    try:
        body = fetch()
        text = text_only(body)
    except Exception:
        return

    rows = []
    for name in CANDIDATES:
        votes = find_votes(text, name)
        if votes is not None:
            rows.append({'name': name, 'votes': votes})

    # Never expose guessed data. Require at least three exact candidate-name matches with vote values.
    if len(rows) < 3:
        existing['sourceUrl'] = URL
        OUT.write_text(json.dumps(existing, indent=2) + '\n')
        return

    total = sum(r['votes'] for r in rows)
    for row in rows:
        row['percent'] = round((row['votes'] / total) * 100, 1) if total else None
    rows.sort(key=lambda r: r['votes'], reverse=True)

    lower = text.lower()
    official = 'official election results' in lower or 'certified election results' in lower
    payload = {
        'display': True,
        'official': official,
        'updatedAt': now.isoformat().replace('+00:00','Z'),
        'sourceUrl': URL,
        'mayor': rows,
    }
    OUT.write_text(json.dumps(payload, indent=2) + '\n')


if __name__ == '__main__':
    main()
