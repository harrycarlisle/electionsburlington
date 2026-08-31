#!/usr/bin/env python3
"""Auto-publish low-risk verified Burlington briefs.

Eligible stories require the editorial queue's evidence and risk gates. Generated
pages inherit Burlington News' shared article experience, sharing metadata and
related-story system so automated posts do not become a separate mini-site.
"""
from __future__ import annotations
import datetime as dt,hashlib,html,json,re
from pathlib import Path
from editorial_policy import is_low_risk
ROOT=Path(__file__).resolve().parents[1];QUEUE=ROOT/'data'/'editorial-queue.json';LEDGER=ROOT/'data'/'auto-published.json';ARTICLES=ROOT/'articles'/'auto'
def slugify(value:str)->str:return re.sub(r'[^a-z0-9]+','-',value.lower().replace('’',"'")).strip('-')[:72] or 'local-update'
def word_count(value:str)->int:return len(re.findall(r"[A-Za-z0-9’']+", value or ''))
def tighten_deck(value:str)->str:
    text=re.sub(r'\s+',' ', (value or '').strip())
    if not text: return 'A verified Burlington update.'
    sentences=[part.strip() for part in re.split(r'(?<=[.!?])\s+', text) if part.strip()]
    if word_count(text)<=22 and len(sentences)<=2: return text
    if word_count(text)<=30 and len(sentences)==1: return text
    keep=sentences[:2] if sentences else [text]
    trimmed=' '.join(keep)
    words=re.findall(r"\S+", trimmed)
    if len(words)>30:
        trimmed=' '.join(words[:30]).rstrip('.,;:') + '.'
    return trimmed
def load(path:Path,fallback):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception:return fallback
def fingerprint(item:dict)->str:
    material='\n'.join(str(item.get(key) or '').strip() for key in ('headline','summary','why','storyGoal','ending','next','date','radarClass'))
    return hashlib.sha256(material.encode('utf-8')).hexdigest()[:20]
def article_html(item:dict,path:str)->str:
    title=html.escape(item.get('headline','Burlington update'));deck=html.escape(tighten_deck(item.get('summary') or item.get('storyGoal') or 'A verified Burlington update.'));why=html.escape(item.get('why') or item.get('storyGoal') or '');source=html.escape(item.get('source') or 'Source');source_url=html.escape(item.get('url') or '');date=html.escape(str(item.get('date') or ''));tag=html.escape(item.get('tag') or 'Burlington');canonical=f'https://burlingtonnews.ca/{path}'
    ending=html.escape(item.get('ending') or item.get('next') or '')
    body=f'<p>{deck}</p>'
    if why and why!=deck:body+=f'<h2>Why it matters</h2><p>{why}</p>'
    if ending and ending not in (deck, why):
        generic=re.search(r'only time will tell|what happens next|remains to be seen|that could change|interesting question is what comes next', ending, re.I)
        if not generic:body+=f'<p>{ending}</p>'
    body+=f'<section class="sources"><h2>Source</h2><p><a href="{source_url}" target="_blank" rel="noopener">{source}</a></p></section>'
    return f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} | Burlington News</title><meta name="description" content="{deck}"><link rel="canonical" href="{canonical}"><link rel="icon" href="/assets/brand/favicon-32x32.png"><link rel="apple-touch-icon" href="/assets/brand/favicon-32x32.png"><link rel="stylesheet" href="/article.css?v=20260825c"><link rel="stylesheet" href="/article-modern.css?v=20260825c"><link rel="stylesheet" href="/site-extra.css?v=20260824z6"><script src="/site-extra.js?v=20260826z" defer></script><meta property="og:type" content="article"><meta property="og:site_name" content="Burlington News"><meta property="og:title" content="{title}"><meta property="og:description" content="{deck}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="https://burlingtonnews.ca/assets/editorial/home-share.webp"><meta name="twitter:card" content="summary_large_image"></head><body class="bn-story-page"><a class="skip" href="#article">Skip to article</a><header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header><main class="article" id="article"><header class="article-head"><span class="article-kicker">{tag}</span><h1>{title}</h1><p class="article-deck">{deck}</p><div class="article-byline">By Burlington News · {date}</div></header><figure class="article-hero"><img src="/assets/editorial/home-share.webp" alt="Burlington News share image" width="1200" height="630"><figcaption>Burlington News</figcaption></figure><div class="article-layout"><article class="article-body">{body}</article></div></main></body></html>'''
def main()->int:
    queue=load(QUEUE,{'publishReady':[]});ledger=load(LEDGER,{'items':[]});known={item.get('sourceUrl'):item for item in ledger.get('items',[]) if item.get('sourceUrl')};ARTICLES.mkdir(parents=True,exist_ok=True);added=[];updated=[]
    for item in queue.get('publishReady',[]):
        source_url=item.get('url')
        if not source_url or not is_low_risk(item):continue
        current_fingerprint=fingerprint(item)
        existing=known.get(source_url)
        if existing:
            if not existing.get('fingerprint'):
                existing['fingerprint']=current_fingerprint
                continue
            if existing.get('fingerprint')==current_fingerprint:continue
            relative=str(existing.get('path') or '').lstrip('/')
            if not relative.startswith('articles/auto/') or not (ROOT/relative).exists():continue
            (ROOT/relative).write_text(article_html(item,relative),encoding='utf-8')
            existing.update({'headline':item.get('headline'),'deck':tighten_deck(item.get('summary') or ''),'date':item.get('date'),'tag':item.get('tag') or 'Burlington','source':item.get('source'),'verificationTier':item.get('verificationTier'),'radarClass':item.get('radarClass'),'followUpTo':item.get('followUpTo') or [],'beatMatches':item.get('beatMatches') or [],'editorialScore':item.get('editorialScore'),'fingerprint':current_fingerprint,'updatedAt':dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z'),'updateCount':int(existing.get('updateCount') or 0)+1})
            updated.append(existing)
            continue
        date=str(item.get('date') or 'update');slug=f"{date}-{slugify(item.get('headline',''))}.html";relative=f'articles/auto/{slug}';target=ROOT/relative;target.write_text(article_html(item,relative),encoding='utf-8');record={'headline':item.get('headline'),'deck':tighten_deck(item.get('summary') or ''),'date':item.get('date'),'tag':item.get('tag') or 'Burlington','path':'/'+relative,'sourceUrl':source_url,'source':item.get('source'),'verificationTier':item.get('verificationTier'),'radarClass':item.get('radarClass'),'followUpTo':item.get('followUpTo') or [],'beatMatches':item.get('beatMatches') or [],'editorialScore':item.get('editorialScore')};ledger.setdefault('items',[]).insert(0,record);added.append(record)
        record['fingerprint']=current_fingerprint;known[source_url]=record
    ledger['items']=ledger.get('items',[])[:100];LEDGER.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(f'Auto-published {len(added)} and updated {len(updated)} verified low-risk brief(s)');return 0
if __name__=='__main__':raise SystemExit(main())
