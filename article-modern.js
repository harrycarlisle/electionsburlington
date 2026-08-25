(() => {
  const isArticle = /\/(articles|stories)\//.test(location.pathname);
  if (!isArticle) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentPath = location.pathname.replace(/^\//,'');
  const body = document.body;
  body.classList.add('bn-story-page');

  function lockArticleSearch(){
    const label = document.querySelector('.site-search-link span');
    if (!label) return;
    const paint = () => { if (label.textContent !== 'Search Burlington') label.textContent = 'Search Burlington'; };
    paint();
    new MutationObserver(paint).observe(label,{childList:true,subtree:true,characterData:true});
  }

  function heroForPath(){
    const slug = currentPath.split('/').pop() || '';
    const map = {
      '730-brant-vacant-building.html':['/assets/editorial/730-brant-share.webp','730 Brant Street, Burlington News illustration','Burlington News illustration'],
      'back-to-school-2026.html':['/assets/home/school-bus.webp','A yellow Ontario school bus','Photo credit in source story'],
      'burlington-rabies-bat-2026.html':['/assets/explore/night-sky-mount-nemo.webp','Night sky over Burlington-area escarpment','Burlington News visual'],
      'fishway-26000-fish.html':['/assets/home/fishway.webp','Cootes Paradise Fishway','Photo credit in source story'],
      'millcroft-phase-2-138-homes.html':['/assets/explore/burlington-orientation-map.svg','Orientation map of Burlington','Burlington News map'],
      'nelson-quarry-tribunal-decision.html':['/assets/explore/night-sky-mount-nemo.webp','Mount Nemo and the Burlington escarpment area','Burlington News visual'],
      'ontario-student-rights-school.html':['/assets/home/school-rights.webp','Students arriving at an Ontario school','Burlington News illustration'],
      'ribfest-2026.html':['/assets/home/ribs.webp','Barbecue ribs at a festival','Photo credit in source story'],
      'salamander-road-closure.html':['/assets/home/salamander.webp','Jefferson salamander','Photo credit in source story'],
      'skyway-bridge-story.html':['/assets/home/skyway-reader.webp','Burlington Bay James N. Allan Skyway','Photo credit in source story'],
      'upper-middle-road-construction-2026.html':['/assets/explore/burlington-orientation-map.svg','Orientation map of Burlington','Burlington News map'],
      'burlington-data-centre-not-ai.html':['/assets/explore/burlington-orientation-map.svg','Orientation map of Burlington','Burlington News map']
    };
    return map[slug] || ['/assets/editorial/home-share.webp','Burlington News','Burlington News'];
  }

  function ensureHero(){
    const main = document.querySelector('main.article');
    const head = main?.querySelector('.article-head');
    if (!main || !head || main.querySelector(':scope > .article-hero')) return;
    const [src,alt,credit] = heroForPath();
    const figure = document.createElement('figure');
    figure.className = 'article-hero article-hero-generated';
    figure.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}" loading="eager"><figcaption>${esc(credit)}</figcaption>`;
    head.insertAdjacentElement('afterend', figure);
  }

  function addShareTools(){
    const head = document.querySelector('.article-head');
    if (!head || head.querySelector('.article-share-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'article-share-tools';
    tools.innerHTML = '<button type="button" data-copy-link>Copy link</button><button type="button" data-share-link>Share</button>';
    const byline = head.querySelector('.article-byline,.byline');
    (byline || head.lastElementChild)?.insertAdjacentElement('afterend',tools);
    const copy = tools.querySelector('[data-copy-link]');
    const share = tools.querySelector('[data-share-link]');
    const copied = () => { const old=copy.textContent; copy.textContent='Copied'; setTimeout(()=>copy.textContent=old,1400); };
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);copied()}catch(_){const t=document.createElement('textarea');t.value=location.href;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();copied()}});
    if (!navigator.share) share.hidden = true;
    else share.addEventListener('click',()=>navigator.share({title:document.title,text:document.querySelector('meta[name="description"]')?.content||'',url:location.href}).catch(()=>{}));
  }

  function storyTokens(item){
    return `${item.label||''} ${item.kind||''} ${item.headline||''}`.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3);
  }

  async function addRelated(){
    if (document.querySelector('.article-related')) return;
    let payload;
    try { const response=await fetch('/data/story-catalog.json',{cache:'no-store'}); if(!response.ok) return; payload=await response.json(); } catch(_) { return; }
    const currentTitle=(document.querySelector('.article-head h1')?.textContent||'').toLowerCase();
    const currentKicker=(document.querySelector('.article-kicker,.eyebrow,.article-head .kicker')?.textContent||'').toLowerCase();
    const currentWords=new Set(`${currentKicker} ${currentTitle}`.split(/[^a-z0-9]+/).filter(word=>word.length>3));
    const items=(payload.items||[]).filter(item=>item.url&&!item.url.startsWith('http')&&!String(item.url).endsWith(currentPath.split('/').pop()));
    items.forEach(item=>{
      const overlap=storyTokens(item).filter(word=>currentWords.has(word)).length;
      const published=Date.parse(item.published||item.activeFrom||'')||0;
      item.__related=overlap*20+(Number(item.signals?.interest||item.signals?.novelty||3)*5)+(published?published/1e13:0)+(item.image?8:0);
    });
    items.sort((a,b)=>b.__related-a.__related);
    const picks=items.slice(0,3);
    if(!picks.length)return;
    const section=document.createElement('section');
    section.className='article-related';
    const storyUrl=item=>String(item.url||'').replace(/^articles\/(.+)\.html$/,'/stories/$1/').replace(/^(?!https?:|\/)/,'/');
    section.innerHTML=`<div class="article-related-head"><h2>You might also like…</h2><a href="/news/">All stories →</a></div><div class="article-related-grid">${picks.map(item=>`<a class="article-related-card" href="${esc(storyUrl(item))}"><img src="/${esc(item.image||'assets/editorial/home-share.webp')}" alt="${esc(item.alt||item.headline||'Burlington News')}" loading="lazy"><span>${esc(item.label||'Burlington')}</span><strong>${esc(item.headline)}</strong></a>`).join('')}</div>`;
    const main=document.querySelector('main.article');
    main?.appendChild(section);
  }

  function addEndCopy(){
    const body=document.querySelector('.article-body');
    if(!body||document.querySelector('.article-share-end'))return;
    const wrap=document.createElement('div');
    wrap.className='article-share-tools article-share-end';
    wrap.innerHTML='<button type="button" data-copy-link>Copy link</button>';
    body.appendChild(wrap);
    const copy=wrap.querySelector('[data-copy-link]');
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy link',1400)}catch(_){}});
  }
  function addReadTime(){
    const byline=document.querySelector('.article-byline,.byline');
    if(!byline||byline.querySelector('[data-read-time]'))return;
    const words=(document.querySelector('.article-body')?.textContent||'').split(/\s+/).filter(Boolean).length;
    const minutes=Math.max(1,Math.round(words/220));
    const stamp=document.createElement('span');
    stamp.dataset.readTime='1';
    stamp.textContent=`${minutes} min read`;
    byline.appendChild(stamp);
  }
  function addSchema(){
    if(document.getElementById('articleStructuredData'))return;
    const title=document.querySelector('.article-head h1')?.textContent?.trim()||document.title;
    const description=document.querySelector('meta[name="description"]')?.content||'';
    const image=document.querySelector('.article-hero img')?.src||'https://burlingtonnews.ca/assets/editorial/home-share.webp';
    const ld=document.createElement('script');
    ld.id='articleStructuredData';
    ld.type='application/ld+json';
    ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:title,description,image:[image],author:{'@type':'Organization',name:'Burlington News'},publisher:{'@type':'NewsMediaOrganization',name:'Burlington News',logo:{'@type':'ImageObject',url:'https://burlingtonnews.ca/logo-mark.png'}},mainEntityOfPage:location.href.split('#')[0]});
    document.head.appendChild(ld);
  }
  function normalizeArticleMeta(){
    const description=document.querySelector('meta[name="description"]')?.content||'';
    const title=document.querySelector('.article-head h1')?.textContent?.trim()||document.title.replace(/\s*\|\s*Burlington News.*/,'');
    const hero=document.querySelector('.article-hero img');
    const image=hero?.src||'https://burlingtonnews.ca/assets/editorial/home-share.webp';
    const canonical=document.querySelector('link[rel="canonical"]');
    const storyPath=location.pathname.replace(/\/articles\/(.+)\.html$/,'/stories/$1/');
    if(canonical&&/\/articles\//.test(canonical.href))canonical.href=`https://burlingtonnews.ca${storyPath}`;
    const url=(canonical?.href)||location.href.split('#')[0];
    const metas=[
      ['property','og:site_name','Burlington News'],['property','og:type','article'],['property','og:title',title],['property','og:description',description],['property','og:url',url],['property','og:image',image],
      ['name','twitter:card','summary_large_image'],['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',image]
    ];
    metas.forEach(([attr,key,value])=>{let node=document.querySelector(`meta[${attr}="${key}"]`);if(!node){node=document.createElement('meta');node.setAttribute(attr,key);document.head.appendChild(node)}node.content=value});
  }

  document.addEventListener('DOMContentLoaded',()=>{
    lockArticleSearch();
    ensureHero();
    addShareTools();
    addEndCopy();
    addReadTime();
    normalizeArticleMeta();
    addSchema();
    document.querySelectorAll('.article-aside').forEach(node=>node.classList.add('article-aside-legacy'));
    addRelated();
  });
})();
