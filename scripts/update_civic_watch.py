#!/usr/bin/env python3
"""Build a source-linked Burlington civic watch and a conservative 30-second brief.

This script can automatically surface public-source updates, but it does not generate
candidate ratings, sentiment scores, allegations, or inferred political conclusions.
Candidate profile changes still require human review.
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
DATA = ROOT / 'data'
ARCHIVE = DATA / 'archive'

SOURCES = [
    {'name':'City of Burlington Election','url':'https://myvote.burlington.ca/','type':'official'},
    {'name':'City of Burlington News','url':'https://www.burlington.ca/en/news-and-notices/news-and-notices.aspx','type':'official'},
    {'name':'City mayoral decisions','url':'https://www.burlington.ca/en/council-and-city-administration/mayoral-decisions.aspx','type':'official'},
    {'name':'BurlingtonToday','url':'https://www.burlingtontoday.com/2026-municipal-election-news','type':'reporting'},
    {'name':'BurlingtonToday','url':'https://www.burlingtontoday.com/local-news','type':'reporting'},
    {'name':'Focus Burlington','url':'https://www.focusburlington.ca/','type':'community'},
]

KEYWORDS = (
    'election','candidate','mayor','council','councillor','budget','tax','housing','development',
    'traffic','transit','ward','data centre','data center','planning','regional council','property tax',
    'debate','vote','voting','poll','results','decision','strong mayor','safety','infrastructure'
)
USER_AGENT='BurlingtonElectionGuide/1.2 (+https://electionsburlington.ca/)'


class LinkParser(HTMLParser):
    def __init__(self,base):
        super().__init__(); self.base=base; self.href=None; self.bits=[]; self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='a':
            href=dict(attrs).get('href')
            if href: self.href=urllib.parse.urljoin(self.base,href); self.bits=[]
    def handle_data(self,data):
        if self.href: self.bits.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=='a' and self.href:
            text=re.sub(r'\s+',' ',html.unescape(' '.join(self.bits))).strip()
            if text: self.links.append({'title':text,'url':self.href})
            self.href=None; self.bits=[]


def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':USER_AGENT})
    with urllib.request.urlopen(req,timeout=25) as r:
        charset=r.headers.get_content_charset() or 'utf-8'
        return r.read().decode(charset,errors='replace')


def relevant(title,url):
    hay=f'{title} {url}'.lower()
    return any(k in hay for k in KEYWORDS)


def clean_links(source,body):
    p=LinkParser(source['url']); p.feed(body)
    seen=set(); items=[]
    for rank,link in enumerate(p.links):
        title=link['title'].strip(' -–—|•'); url=link['url']
        if len(title)<12 or len(title)>180 or not relevant(title,url): continue
        key=(title.lower(),url.split('#')[0].rstrip('/'))
        if key in seen: continue
        seen.add(key)
        items.append({'title':title,'url':url,'source':source['name'],'sourceType':source['type'],'pageRank':rank})
    return items[:25]


def meta_value(body,key):
    pats=[
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
    ]
    for pat in pats:
        m=re.search(pat,body,re.I)
        if m: return html.unescape(m.group(1)).strip()
    return ''


def enrich(item):
    try:
        body=fetch(item['url'])
    except Exception:
        return item
    desc=meta_value(body,'description') or meta_value(body,'og:description')
    image=meta_value(body,'og:image')
    published=meta_value(body,'article:published_time') or meta_value(body,'date')
    og_type=meta_value(body,'og:type').lower()
    if desc:
        desc=re.sub(r'\s+',' ',desc).strip()
        if len(desc)>260: desc=desc[:257].rsplit(' ',1)[0]+'…'
        item['description']=desc
    if image and image.startswith('http'): item['image']=image
    if published: item['published']=published
    if 'video' in og_type or 'youtube' in item['url'].lower() or 'video' in item['title'].lower(): item['mediaType']='video'
    return item


def importance(item):
    s=f"{item['title']} {item.get('description','')}".lower(); score=1
    if item['sourceType']=='official': score+=1
    if any(k in s for k in ('election results','unofficial results','official results','elected','winner','voting opens','election day')): score+=4
    elif any(k in s for k in ('mayoral debate','all-candidates','debate','budget approved','budget adopted','tax increase','mayoral decision')): score+=3
    elif any(k in s for k in ('candidate','platform','ward boundar','data centre','development application','council vote')): score+=2
    elif any(k in s for k in ('housing','traffic','transit','safety','infrastructure','property tax','budget')): score+=1
    return min(score,5)


def why_for(item):
    s=f"{item['title']} {item.get('description','')}".lower()
    if 'result' in s or 'elected' in s or 'winner' in s: return 'This changes who will represent Burlington and what happens next at City Hall.'
    if 'debate' in s or 'all-candidates' in s: return 'It gives voters a direct chance to compare candidates before voting.'
    if 'ward boundar' in s: return 'Your ward determines which councillor race and Election Day locations apply to you.'
    if 'budget' in s or 'property tax' in s or 'tax increase' in s: return 'It can affect city services and the Burlington portion of the property-tax bill.'
    if 'data centre' in s or 'development' in s or 'housing' in s: return 'It can affect where and how Burlington grows.'
    if 'candidate' in s or 'platform' in s: return 'It adds information voters can use to compare candidates.'
    if 'mayoral decision' in s: return 'It records a formal use of mayoral authority that can affect city policy or administration.'
    return ''


def tag_for(item):
    s=item['title'].lower()
    if 'debate' in s or 'all-candidates' in s: return 'Debate'
    if 'result' in s or 'elected' in s: return 'Results'
    if 'ward' in s: return 'Your ward'
    if 'budget' in s or 'tax' in s: return 'Budget'
    if 'housing' in s or 'development' in s or 'data centre' in s: return 'Growth'
    if 'candidate' in s or 'platform' in s: return 'Candidates'
    if 'mayor' in s or 'council' in s: return 'City Hall'
    return 'Burlington'


def date_key(item):
    raw=item.get('published','')
    if raw:
        try: return dt.datetime.fromisoformat(raw.replace('Z','+00:00')).timestamp()
        except Exception: pass
    return -float(item.get('pageRank',9999))


def main():
    now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    collected=[]; source_status=[]
    for source in SOURCES:
        try:
            body=fetch(source['url']); links=clean_links(source,body); collected.extend(links)
            source_status.append({'source':source['name'],'ok':True,'found':len(links)})
        except Exception as exc:
            source_status.append({'source':source['name'],'ok':False,'error':str(exc)[:180]})

    deduped=[]; seen=set()
    for item in collected:
        key=item['url'].split('#')[0].rstrip('/')
        if key in seen: continue
        seen.add(key); deduped.append(item)

    # Enrich only the highest-ranked links so the job remains polite and fast.
    candidates=sorted(deduped,key=lambda x:(x['sourceType']!='official',x.get('pageRank',9999)))[:22]
    enriched=[enrich(dict(x)) for x in candidates]
    for item in enriched:
        item['importance']=importance(item); item['why']=why_for(item); item['tag']=tag_for(item)

    enriched.sort(key=lambda x:(x['importance'],date_key(x),-x.get('pageRank',9999)),reverse=True)
    top=[]; used_sources={}
    for item in enriched:
        # Avoid letting one publication occupy the whole 30-second brief.
        count=used_sources.get(item['source'],0)
        if count>=2: continue
        top.append(item); used_sources[item['source']]=count+1
        if len(top)==3: break

    monitor={
        'checkedAt':now.isoformat().replace('+00:00','Z'),
        'method':'Rule-based source monitor. No sentiment score, endorsement or inferred political conclusion is generated.',
        'sources':source_status,
        'items':deduped[:80],
    }
    DATA.mkdir(parents=True,exist_ok=True); ARCHIVE.mkdir(parents=True,exist_ok=True)
    (DATA/'source-monitor.json').write_text(json.dumps(monitor,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (ARCHIVE/f'{now.date().isoformat()}.json').write_text(json.dumps(monitor,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

    if top:
        brief_items=[]
        for item in top:
            summary=item.get('description') or item['title']
            brief_items.append({
                'date':item.get('published','')[:10] or now.date().isoformat(),
                'tag':item['tag'],
                'headline':item['title'],
                'summary':summary,
                'why':item['why'],
                'importance':item['importance'],
                'source':item['source'],
                'sourceType':item['sourceType'],
                'url':item['url'],
                **({'image':item['image']} if item.get('image') else {}),
                **({'mediaType':item['mediaType']} if item.get('mediaType') else {}),
            })
        brief={'updated':now.isoformat().replace('+00:00','Z'),'items':brief_items,'sourcesCheckedAt':now.isoformat().replace('+00:00','Z')}
        (DATA/'daily-brief.json').write_text(json.dumps(brief,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


if __name__=='__main__': main()
