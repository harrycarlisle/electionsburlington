#!/usr/bin/env python3
"""Auto-publish low-risk verified Burlington briefs.

Eligible stories require the editorial queue's evidence and risk gates. Generated
pages inherit Burlington News' shared article experience, sharing metadata and
related-story system so automated posts do not become a separate mini-site.
"""
from __future__ import annotations
import html,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];QUEUE=ROOT/'data'/'editorial-queue.json';LEDGER=ROOT/'data'/'auto-published.json';ARTICLES=ROOT/'articles'/'auto'
def slugify(value:str)->str:return re.sub(r'[^a-z0-9]+','-',value.lower().replace('’',"'")).strip('-')[:72] or 'local-update'
def load(path:Path,fallback):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception:return fallback
def article_html(item:dict,path:str)->str:
    title=html.escape(item.get('headline','Burlington update'));deck=html.escape(item.get('summary') or item.get('storyGoal') or 'A verified Burlington update.');why=html.escape(item.get('why') or item.get('storyGoal') or '');source=html.escape(item.get('source') or 'Source');source_url=html.escape(item.get('url') or '');date=html.escape(str(item.get('date') or ''));tag=html.escape(item.get('tag') or 'Burlington');canonical=f'https://burlingtonnews.ca/{path}'
    body=f'<p>{deck}</p>'
    if why and why!=deck:body+=f'<h2>Why it matters</h2><p>{why}</p>'
    body+=f'<section class="sources"><h2>Source</h2><p><a href="{source_url}" target="_blank" rel="noopener">{source}</a></p></section>'
    return f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} | Burlington News</title><meta name="description" content="{deck}"><link rel="canonical" href="{canonical}"><link rel="icon" href="/logo-mark.png?v=20260825a"><link rel="apple-touch-icon" href="/logo-mark.png?v=20260825a"><link rel="stylesheet" href="/article.css?v=20260825b"><link rel="stylesheet" href="/site-extra.css?v=20260824z6"><script src="/site-extra.js?v=20260825a" defer></script><meta property="og:type" content="article"><meta property="og:site_name" content="Burlington News"><meta property="og:title" content="{title}"><meta property="og:description" content="{deck}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="https://burlingtonnews.ca/assets/editorial/home-share.webp"><meta name="twitter:card" content="summary_large_image"></head><body><a class="skip" href="#article">Skip to article</a><header class="header"><div class="wrap header-inner"><a class="brand" href="/">Burlington News</a><button class="menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mainNav">Menu</button><nav class="nav" id="mainNav" aria-label="Primary"></nav></div></header><main class="article" id="article"><header class="article-head"><span class="eyebrow">{tag}</span><h1>{title}</h1><p class="dek">{deck}</p><div class="byline">Burlington News · {date}</div></header><figure class="article-hero"><img src="/assets/editorial/home-share.webp" alt="Burlington News" width="1200" height="630"><figcaption>Burlington News</figcaption></figure><div class="article-layout"><article class="article-body">{body}</article></div></main></body></html>'''
def main()->int:
    queue=load(QUEUE,{'publishReady':[]});ledger=load(LEDGER,{'items':[]});known={item.get('sourceUrl') for item in ledger.get('items',[])};ARTICLES.mkdir(parents=True,exist_ok=True);added=[]
    for item in queue.get('publishReady',[]):
        source_url=item.get('url')
        if not source_url or source_url in known:continue
        date=str(item.get('date') or 'update');slug=f"{date}-{slugify(item.get('headline',''))}.html";relative=f'articles/auto/{slug}';target=ROOT/relative;target.write_text(article_html(item,relative),encoding='utf-8');record={'headline':item.get('headline'),'deck':item.get('summary'),'date':item.get('date'),'tag':item.get('tag') or 'Burlington','path':'/'+relative,'sourceUrl':source_url,'editorialScore':item.get('editorialScore')};ledger.setdefault('items',[]).insert(0,record);known.add(source_url);added.append(record)
    ledger['items']=ledger.get('items',[])[:100];LEDGER.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(f'Auto-published {len(added)} verified low-risk brief(s)');return 0
if __name__=='__main__':raise SystemExit(main())
