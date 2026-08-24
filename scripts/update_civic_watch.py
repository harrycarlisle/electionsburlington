#!/usr/bin/env python3
"""Build an evergreen, source-linked Burlington civic and political watch.

The monitor covers City Hall, Halton Region, planning/development, housing,
transit, taxes, council decisions, mayoral decisions and election news.
It does not generate candidate ratings, sentiment scores, allegations or inferred
political conclusions. Candidate profile changes still require human review.

Publication rules:
- A briefing item must resolve to a real article/page and its title must match the
  listing text closely enough to verify the item was not scraped from an unrelated link.
- Source tier affects confidence, not political favourability.
- Images are optional. A card is never given a generic filler image.
- The same image is not reused for two different recent stories within eight hours.
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
IMAGE_HISTORY = DATA / 'image-history.json'

SOURCES = [
    {'name':'City of Burlington News','url':'https://www.burlington.ca/en/news-and-notices/news-and-notices.aspx','type':'official','scope':'city','images':True},
    {'name':'City mayoral decisions','url':'https://www.burlington.ca/en/council-and-city-administration/mayoral-decisions.aspx','type':'official','scope':'city','images':True},
    {'name':'City development applications','url':'https://www.burlington.ca/en/planning-and-development/development-applications.aspx','type':'official','scope':'city','images':True},
    {'name':'City of Burlington Election','url':'https://myvote.burlington.ca/','type':'official','scope':'election','images':True},
    {'name':'Halton Region','url':'https://www.halton.ca/news/media-releases','type':'official','scope':'region','images':True},
    {'name':'Metrolinx','url':'https://www.metrolinx.com/en/news/archive','type':'official','scope':'transit','images':True},
    {'name':'BurlingtonToday','url':'https://www.burlingtontoday.com/local-news','type':'reporting','scope':'city','images':True},
    {'name':'BurlingtonToday Election','url':'https://www.burlingtontoday.com/municipal-election','type':'reporting','scope':'election','images':True},
    {'name':'Focus Burlington','url':'https://www.focusburlington.ca/','type':'community','scope':'city','images':False},
]

TOPIC_KEYWORDS = (
    'election','candidate','mayor','council','councillor','budget','tax','housing','development',
    'traffic','transit','ward','data centre','data center','planning','regional council','property tax',
    'debate','vote','voting','poll','results','decision','strong mayor','safety','infrastructure',
    'official plan','zoning','go station','go transit','lakeshore west','metrolinx','presto','road',
    'water','wastewater','regional chair','public meeting','by-law','bylaw','motion','city hall',
    'community centre','park','development application','appeal','ontario land tribunal','train station'
)
REGIONAL_TERMS = ('burlington','regional council','regional chair','halton budget','halton housing','water','wastewater','regional road','growth','infrastructure','police board')
TRANSIT_TERMS = ('burlington','burlington station','appleby','burloak','lakeshore west','hamilton','confederation go','go station','go transit','presto','rail bridge')
USER_AGENT='BurlingtonElectionGuide/1.5 (+https://electionsburlington.ca/)'


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
        return r.read().decode(charset,errors='replace'), r.headers.get('Content-Type','')


def relevant(source,title,url):
    hay=f'{title} {url}'.lower()
    if not any(k in hay for k in TOPIC_KEYWORDS): return False
    if source.get('scope')=='transit': return any(k in hay for k in TRANSIT_TERMS)
    if source.get('scope')=='region': return any(k in hay for k in REGIONAL_TERMS)
    return True


def clean_links(source,body):
    p=LinkParser(source['url']); p.feed(body)
    seen=set(); items=[]
    for rank,link in enumerate(p.links):
        title=link['title'].strip(' -–—|•'); url=link['url']
        if len(title)<12 or len(title)>180 or not relevant(source,title,url): continue
        if urllib.parse.urlparse(url).scheme not in ('http','https'): continue
        key=(title.lower(),url.split('#')[0].rstrip('/'))
        if key in seen: continue
        seen.add(key)
        items.append({'title':title,'url':url,'source':source['name'],'sourceType':source['type'],'scope':source.get('scope','city'),'allowImage':bool(source.get('images')),'pageRank':rank})
    return items[:35]


def meta_value(body,key):
    pats=[rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']']
    for pat in pats:
        m=re.search(pat,body,re.I)
        if m: return html.unescape(m.group(1)).strip()
    return ''


def page_title(body):
    t=meta_value(body,'og:title') or meta_value(body,'twitter:title')
    if t: return t
    m=re.search(r'<title[^>]*>(.*?)</title>',body,re.I|re.S)
    return re.sub(r'\s+',' ',html.unescape(m.group(1))).strip() if m else ''


def title_match(a,b):
    stop={'the','a','an','and','or','to','of','for','in','on','at','is','are','with','from','this','that','city','burlington'}
    ta={x for x in re.findall(r'[a-z0-9]+',a.lower()) if len(x)>2 and x not in stop}
    tb={x for x in re.findall(r'[a-z0-9]+',b.lower()) if len(x)>2 and x not in stop}
    if not ta or not tb: return False
    return len(ta & tb)/max(1,min(len(ta),len(tb))) >= .45


def enrich(item):
    try: body,_=fetch(item['url'])
    except Exception:
        item['verified']=False; item['verificationReason']='Page could not be retrieved'; return item
    actual=page_title(body)
    if actual and not title_match(item['title'],actual):
        item['verified']=False; item['verificationReason']='Listing title did not match destination page'; return item
    desc=meta_value(body,'description') or meta_value(body,'og:description')
    image=meta_value(body,'og:image') if item.get('allowImage') else ''
    published=meta_value(body,'article:published_time') or meta_value(body,'date')
    og_type=meta_value(body,'og:type').lower()
    if desc:
        desc=re.sub(r'\s+',' ',desc).strip()
        if len(desc)>260: desc=desc[:257].rsplit(' ',1)[0]+'…'
        item['description']=desc
    if image and image.startswith('http') and not any(x in image.lower() for x in ('logo','favicon','icon','sprite')):
        item['image']=image; item['imageSource']=item['source']; item['imageSourceUrl']=item['url']
    if published: item['published']=published
    if 'video' in og_type or 'youtube' in item['url'].lower() or 'video' in item['title'].lower(): item['mediaType']='video'
    item['verified']=True
    item['verificationTier']='primary' if item['sourceType']=='official' else ('reported' if item['sourceType']=='reporting' else 'community')
    return item


def importance(item):
    s=f"{item['title']} {item.get('description','')}".lower(); score=1
    if item['sourceType']=='official': score+=1
    if any(k in s for k in ('election results','unofficial results','official results','elected','winner','election day','voting closes')): score+=4
    elif any(k in s for k in ('voting opens','mayoral debate','all-candidates','budget approved','budget adopted','tax increase','mayoral decision','major construction','new station','go station')): score+=3
    elif any(k in s for k in ('council decision','candidate','platform','ward boundar','data centre','development application','council vote','official plan','zoning','regional chair')): score+=2
    elif any(k in s for k in ('housing','traffic','transit','safety','infrastructure','property tax','budget','water','wastewater','park','community centre')): score+=1
    return min(score,5)


def why_for(item):
    s=f"{item['title']} {item.get('description','')}".lower()
    if 'result' in s or 'elected' in s or 'winner' in s: return 'This changes who represents Burlington and what happens next at City Hall.'
    if 'debate' in s or 'all-candidates' in s: return 'It gives voters a direct chance to compare candidates before voting.'
    if 'ward boundar' in s: return 'Your ward determines which councillor race and Election Day locations apply to you.'
    if 'budget' in s or 'property tax' in s or 'tax increase' in s: return 'It can affect city services and the Burlington portion of the property-tax bill.'
    if 'go station' in s or 'go transit' in s or 'lakeshore west' in s or 'metrolinx' in s: return 'It can change how Burlington residents commute and connect to the regional transit network.'
    if 'data centre' in s or 'development' in s or 'housing' in s or 'zoning' in s or 'official plan' in s: return 'It can affect where, how and how quickly Burlington grows.'
    if 'regional chair' in s or 'regional council' in s: return 'Halton Region controls services and spending that directly affect Burlington residents.'
    if 'candidate' in s or 'platform' in s: return 'It adds information voters can use to compare candidates.'
    if 'mayoral decision' in s or 'council decision' in s or 'council vote' in s: return 'It records a formal City Hall decision that can change policy, spending or services.'
    return ''


def tag_for(item):
    s=item['title'].lower()
    if 'debate' in s or 'all-candidates' in s: return 'Debate'
    if 'result' in s or 'elected' in s: return 'Results'
    if 'ward' in s: return 'Your ward'
    if 'budget' in s or 'tax' in s: return 'Budget'
    if 'go ' in s or 'metrolinx' in s or 'transit' in s or 'station' in s: return 'Transit'
    if 'housing' in s or 'development' in s or 'zoning' in s or 'official plan' in s or 'data centre' in s: return 'Growth'
    if 'candidate' in s or 'platform' in s: return 'Candidates'
    if 'regional' in s or item.get('scope')=='region': return 'Halton Region'
    if 'mayor' in s or 'council' in s or 'decision' in s: return 'City Hall'
    return 'Burlington'


def date_key(item):
    raw=item.get('published','')
    if raw:
        try: return dt.datetime.fromisoformat(raw.replace('Z','+00:00')).timestamp()
        except Exception: pass
    return -float(item.get('pageRank',9999))


def recent_image_conflict(image,url,now,history):
    if not image: return False
    cutoff=now-dt.timedelta(hours=8)
    for rec in history:
        try: used=dt.datetime.fromisoformat(rec.get('usedAt','').replace('Z','+00:00'))
        except Exception: continue
        if used<cutoff: continue
        if rec.get('image')==image and rec.get('url')!=url: return True
    return False


def main():
    now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    try: history=json.loads(IMAGE_HISTORY.read_text(encoding='utf-8')).get('items',[])
    except Exception: history=[]
    collected=[]; source_status=[]
    for source in SOURCES:
        try:
            body,_=fetch(source['url']); links=clean_links(source,body); collected.extend(links)
            source_status.append({'source':source['name'],'ok':True,'found':len(links)})
        except Exception as exc:
            source_status.append({'source':source['name'],'ok':False,'error':str(exc)[:180]})

    deduped=[]; seen=set()
    for item in collected:
        key=item['url'].split('#')[0].rstrip('/')
        if key in seen: continue
        seen.add(key); deduped.append(item)

    candidates=sorted(deduped,key=lambda x:(x['sourceType']!='official',x.get('pageRank',9999)))[:45]
    enriched=[enrich(dict(x)) for x in candidates]
    enriched=[x for x in enriched if x.get('verified')]
    for item in enriched:
        item['importance']=importance(item); item['why']=why_for(item); item['tag']=tag_for(item)

    enriched.sort(key=lambda x:(x['importance'],date_key(x),-x.get('pageRank',9999)),reverse=True)
    top=[]; used_sources={}; current_images=set()
    for item in enriched:
        if used_sources.get(item['source'],0)>=2: continue
        image=item.get('image')
        if image and (image in current_images or recent_image_conflict(image,item['url'],now,history)):
            item.pop('image',None); item.pop('imageSource',None); item.pop('imageSourceUrl',None); image=None
        top.append(item); used_sources[item['source']]=used_sources.get(item['source'],0)+1
        if image: current_images.add(image)
        if len(top)==3: break

    monitor={'checkedAt':now.isoformat().replace('+00:00','Z'),'method':'Verified, rule-based Burlington civic monitor. Destination pages are checked before publication; no sentiment score, endorsement or inferred political conclusion is generated.','sources':source_status,'items':enriched[:100]}
    DATA.mkdir(parents=True,exist_ok=True); ARCHIVE.mkdir(parents=True,exist_ok=True)
    (DATA/'source-monitor.json').write_text(json.dumps(monitor,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (ARCHIVE/f'{now.date().isoformat()}.json').write_text(json.dumps(monitor,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

    if top:
        brief_items=[]
        for item in top:
            brief_items.append({'date':item.get('published','')[:10] or now.date().isoformat(),'tag':item['tag'],'headline':item['title'],'summary':item.get('description') or item['title'],'why':item['why'],'importance':item['importance'],'source':item['source'],'sourceType':item['sourceType'],'verificationTier':item.get('verificationTier'),'url':item['url'],**({'image':item['image'],'imageSource':item.get('imageSource'),'imageSourceUrl':item.get('imageSourceUrl')} if item.get('image') else {}),**({'mediaType':item['mediaType']} if item.get('mediaType') else {})})
        brief={'updated':now.isoformat().replace('+00:00','Z'),'scope':'Burlington politics and civic affairs','items':brief_items,'sourcesCheckedAt':now.isoformat().replace('+00:00','Z')}
        (DATA/'daily-brief.json').write_text(json.dumps(brief,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        for item in brief_items:
            if item.get('image'): history.append({'image':item['image'],'url':item['url'],'usedAt':now.isoformat().replace('+00:00','Z')})
        cutoff=now-dt.timedelta(hours=24)
        kept=[]
        for rec in history:
            try: used=dt.datetime.fromisoformat(rec.get('usedAt','').replace('Z','+00:00'))
            except Exception: continue
            if used>=cutoff: kept.append(rec)
        IMAGE_HISTORY.write_text(json.dumps({'items':kept[-100:]},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


if __name__=='__main__': main()
