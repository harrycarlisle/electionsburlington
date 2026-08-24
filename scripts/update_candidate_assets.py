#!/usr/bin/env python3
"""Add candidate photos only when identity can be verified with high confidence.

Rules:
- The candidate name must already exist in the City-derived ballot data.
- Prefer the candidate-supplied website listed in ballot.json.
- A candidate-site image is accepted only when the page contains the exact candidate
  name plus Burlington/election context AND either the image alt text identifies the
  candidate or the page exposes a non-logo social image.
- Exact-name BurlingtonToday candidate profiles are a fallback.
- Existing manually verified images are never replaced automatically.
- If identity cannot be verified, keep the initials placeholder. Never guess.
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
UA = 'BurlingtonElectionGuide/1.5 (+https://electionsburlington.ca/)'
BT_INDEX = 'https://www.burlingtontoday.com/2026-municipal-election-news'


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read(2_000_000)
        return raw.decode(r.headers.get_content_charset() or 'utf-8', errors='replace'), r.headers.get('Content-Type', '')


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
    url = urllib.parse.urljoin(base, html.unescape(url))
    low = url.lower()
    if any(x in low for x in ('favicon', 'logo.', '/logo', 'icon.', '/icon', 'sprite', 'paypal')):
        return ''
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': 'bytes=0-2047'})
        with urllib.request.urlopen(req, timeout=15) as r:
            if not r.headers.get('Content-Type', '').lower().startswith('image/'):
                return ''
    except Exception:
        return ''
    return url


class PageParser(HTMLParser):
    def __init__(self, base: str):
        super().__init__(); self.base=base; self.current=None; self.bits=[]; self.links=[]; self.images=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); tag=tag.lower()
        if tag=='a':
            href=attrs.get('href')
            if href: self.current=urllib.parse.urljoin(self.base,href); self.bits=[]
        elif tag=='img':
            src=attrs.get('src') or attrs.get('data-src') or attrs.get('data-image') or attrs.get('data-lazy-src')
            if src: self.images.append((attrs.get('alt',''),urllib.parse.urljoin(self.base,src)))
    def handle_data(self, data):
        if self.current:self.bits.append(data)
    def handle_endtag(self, tag):
        if tag.lower()=='a' and self.current:
            label=re.sub(r'\s+',' ',' '.join(self.bits)).strip()
            if label:self.links.append((label,self.current))
            self.current=None;self.bits=[]


def all_candidates(data: dict) -> list[str]:
    out=list(data.get('mayor',[]))
    for w in data.get('wards',{}).values():out+=w.get('councillor',[])+w.get('publicTrustee',[])+w.get('catholicTrustee',[])
    out+=data.get('frenchPublicTrustee',[])+data.get('frenchCatholicTrustee',[])
    return list(dict.fromkeys(out))


def named_candidate_image(body: str, base: str, name: str) -> str:
    p=PageParser(base);p.feed(body)
    target=norm(name); parts=[x for x in target.split() if len(x)>2]
    ranked=[]
    for alt,url in p.images:
        hay=norm(f'{alt} {urllib.parse.unquote(url)}')
        exact=target in hay
        tokens=len(parts)>=2 and all(x in hay for x in (parts[0],parts[-1]))
        if not (exact or tokens):continue
        if any(x in hay for x in ('family','team','group','volunteer','logo','sign','donate')):continue
        score=(5 if exact else 3)+(2 if any(x in hay for x in ('candidate','councillor','council','mayor','trustee','portrait','headshot')) else 0)
        ranked.append((score,url))
    for _,url in sorted(ranked,reverse=True):
        good=valid_image_url(url,base)
        if good:return good
    return ''


def from_candidate_site(name: str, url: str) -> dict | None:
    try:body,_=fetch(url)
    except Exception:return None
    text=norm(visible_text(body)[:150000])
    if norm(name) not in text:return None
    if not any(k in text for k in ('burlington','candidate','council','councillor','mayor','trustee','ward')):return None
    image=named_candidate_image(body,url,name)
    if not image:image=valid_image_url(meta(body,'og:image'),url)
    if not image:return None
    return {'url':image,'source':'Candidate website','sourceUrl':url,'verifiedAt':dt.date.today().isoformat(),'match':'high'}


def burlington_today_candidates(names: list[str]) -> dict[str, dict]:
    try:body,_=fetch(BT_INDEX)
    except Exception:return {}
    p=PageParser(BT_INDEX);p.feed(body);results={}
    for name in names:
        n=norm(name)
        for label,url in p.links:
            label_n=norm(label)
            if n not in label_n:continue
            if not any(k in label_n for k in ('candidate','seeks','running','vying','mayor','ward','trustee')):continue
            try:article,_=fetch(url)
            except Exception:continue
            title=meta(article,'og:title') or meta(article,'twitter:title') or label
            if n not in norm(title):continue
            image=valid_image_url(meta(article,'og:image'),url)
            if image:
                results[name]={'url':image,'source':'BurlingtonToday','sourceUrl':url,'verifiedAt':dt.date.today().isoformat(),'match':'high'}
                break
    return results


def main():
    data=json.loads(BALLOT.read_text(encoding='utf-8'));images=data.setdefault('candidateImages',{});names=all_candidates(data)
    for name in names:
        if name in images:continue
        site=data.get('candidateWebsites',{}).get(name)
        if site:
            found=from_candidate_site(name,site)
            if found:images[name]=found
    missing=[n for n in names if n not in images]
    for name,record in burlington_today_candidates(missing).items():images.setdefault(name,record)
    data['candidateImagesLastChecked']=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    BALLOT.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


if __name__=='__main__':main()
