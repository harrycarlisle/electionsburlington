#!/usr/bin/env python3
"""Add candidate photos only when identity can be verified with high confidence.

Rules:
- Candidate names must already exist in City-derived ballot data.
- Prefer candidate-supplied websites.
- Candidate-site pages must contain the exact name plus Burlington/election context.
- Prefer an image whose alt/src directly identifies the candidate; a non-logo social image is fallback.
- Exact-name BurlingtonToday candidate profiles are a fallback.
- Group, family, logo and obvious non-portrait images are rejected.
- If identity cannot be verified, keep initials. Never guess.
"""
from __future__ import annotations
import datetime as dt, html, json, re, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1];BALLOT=ROOT/'data'/'ballot.json';UA='BurlingtonNews/2.0 (+https://burlingtonnews.ca/)'
BT_INDEXES=['https://www.burlingtontoday.com/2026-municipal-election-news','https://www.burlingtontoday.com/municipal-election']
BAD_IMAGE_WORDS=('favicon','logo','icon','sprite','paypal','family','group','team-photo','volunteer')

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=20) as r:return r.read(2_000_000).decode(r.headers.get_content_charset() or 'utf-8',errors='replace'),r.headers.get('Content-Type','')
def meta(body,key):
    for pat in (rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']'):
        m=re.search(pat,body,re.I)
        if m:return html.unescape(m.group(1)).strip()
    return ''
def visible_text(body):
    body=re.sub(r'<script\b[^>]*>.*?</script>',' ',body,flags=re.I|re.S);body=re.sub(r'<style\b[^>]*>.*?</style>',' ',body,flags=re.I|re.S);return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',body))).strip()
def norm(s):return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
def obvious_bad(url):return any(x in urllib.parse.unquote(url).lower() for x in BAD_IMAGE_WORDS)
def valid_image_url(url,base):
    if not url:return ''
    url=urllib.parse.urljoin(base,html.unescape(url))
    if obvious_bad(url):return ''
    headers_to_try=({'User-Agent':UA,'Range':'bytes=0-2047'},{'User-Agent':UA})
    for headers in headers_to_try:
        try:
            req=urllib.request.Request(url,headers=headers)
            with urllib.request.urlopen(req,timeout=15) as r:
                if r.headers.get('Content-Type','').lower().startswith('image/'):
                    r.read(64)
                    return url
        except Exception:
            continue
    return ''

class PageParser(HTMLParser):
    def __init__(self,base):super().__init__();self.base=base;self.current=None;self.bits=[];self.links=[];self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);tag=tag.lower()
        if tag=='a':
            href=a.get('href')
            if href:self.current=urllib.parse.urljoin(self.base,href);self.bits=[]
        elif tag=='img':
            src=a.get('src') or a.get('data-src') or a.get('data-image') or a.get('data-lazy-src')
            if src:self.images.append((a.get('alt',''),urllib.parse.urljoin(self.base,src)))
    def handle_data(self,data):
        if self.current:self.bits.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=='a' and self.current:
            label=re.sub(r'\s+',' ',' '.join(self.bits)).strip()
            if label:self.links.append((label,self.current))
            self.current=None;self.bits=[]

def all_candidates(data):
    out=list(data.get('mayor',[]))
    for w in data.get('wards',{}).values():out+=w.get('councillor',[])+w.get('publicTrustee',[])+w.get('catholicTrustee',[])
    out+=data.get('frenchPublicTrustee',[])+data.get('frenchCatholicTrustee',[]);return list(dict.fromkeys(out))
def named_candidate_image(body,base,name):
    p=PageParser(base);p.feed(body);target=norm(name);parts=[x for x in target.split() if len(x)>2];ranked=[]
    for alt,url in p.images:
        hay=norm(f'{alt} {urllib.parse.unquote(url)}');exact=target in hay;tokens=len(parts)>=2 and parts[0] in hay and parts[-1] in hay
        if not(exact or tokens) or obvious_bad(f'{alt} {url}'):continue
        score=(5 if exact else 3)+(2 if any(x in hay for x in ('candidate','councillor','council','mayor','trustee','portrait','headshot')) else 0);ranked.append((score,url))
    for _,url in sorted(ranked,reverse=True):
        good=valid_image_url(url,base)
        if good:return good
    return ''
def from_candidate_site(name,url):
    try:body,_=fetch(url)
    except Exception:return None
    text=norm(visible_text(body)[:150000])
    if norm(name) not in text or not any(k in text for k in ('burlington','candidate','council','councillor','mayor','trustee','ward')):return None
    image=named_candidate_image(body,url,name) or valid_image_url(meta(body,'og:image'),url)
    if not image:return None
    return {'url':image,'source':'Candidate website','sourceUrl':url,'verifiedAt':dt.date.today().isoformat(),'match':'high'}
def burlington_today_candidates(names):
    links=[]
    for index in BT_INDEXES:
        try:body,_=fetch(index)
        except Exception:continue
        p=PageParser(index);p.feed(body);links.extend(p.links)
    results={}
    for name in names:
        n=norm(name)
        for label,url in links:
            ln=norm(label)
            if n not in ln or not any(k in ln for k in ('candidate','seeks','running','vying','mayor','ward','trustee','enters')):continue
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
    for name,record in list(images.items()):
        if obvious_bad(record.get('url','')):images.pop(name,None)
    for name in names:
        if name in images:continue
        site=data.get('candidateWebsites',{}).get(name)
        if site:
            found=from_candidate_site(name,site)
            if found:images[name]=found
    missing=[n for n in names if n not in images]
    for name,record in burlington_today_candidates(missing).items():images.setdefault(name,record)
    data['candidateImagesLastChecked']=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z');BALLOT.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
if __name__=='__main__':main()
