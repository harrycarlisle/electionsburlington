(() => {
  const isArticle = /\/(articles|stories)\//.test(location.pathname);
  if (!isArticle) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pathParts = location.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
  const currentSlug = (pathParts[pathParts.length-1]||'').replace(/\.html$/,'');
  document.body.classList.add('bn-story-page');

  function lockArticleSearch(){
    const paint=()=>{
      const input=document.querySelector('.header-search input,.site-search input');
      if(input&&input.placeholder!=='Search Burlington') input.placeholder='Search Burlington';
      const label=document.querySelector('.site-search-link span');
      if(label&&label.textContent!=='Search Burlington') label.textContent='Search Burlington';
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  function heroForPath(){
    const map = {
      '730-brant-vacant-building':['/assets/editorial/730-brant-share.webp','730 Brant Street, Burlington News illustration','Burlington News illustration'],
      'back-to-school-2026':['/assets/home/school-bus.webp','A yellow Ontario school bus','Photo credit in source story'],
      'burlington-rabies-bat-2026':['/assets/explore/night-sky-mount-nemo.webp','Night sky over Burlington-area escarpment','Burlington News visual'],
      'fishway-26000-fish':['/assets/home/fishway.webp','Cootes Paradise Fishway','Photo credit in source story'],
      'millcroft-phase-2-138-homes':['/assets/explore/burlington-orientation-map.svg','Orientation map of Burlington','Burlington News map'],
      'nelson-quarry-tribunal-decision':['/assets/explore/night-sky-mount-nemo.webp','Mount Nemo and the Burlington escarpment area','Burlington News visual'],
      'ontario-student-rights-school':['/assets/home/school-rights.webp','Students arriving at an Ontario school','Burlington News illustration'],
      'ribfest-2026':['/assets/home/ribs.webp','Barbecue ribs at a festival','Photo credit in source story'],
      'salamander-road-closure':['/assets/home/salamander.webp','Jefferson salamander','Photo credit in source story'],
      'skyway-bridge-story':['/assets/home/skyway-reader.webp','Burlington Bay James N. Allan Skyway','Photo credit in source story'],
      'upper-middle-road-construction-2026':['/assets/explore/burlington-orientation-map.svg','Orientation map of Burlington','Burlington News map'],
      'burlington-data-centre-not-ai':['/assets/editorial/data-centre-site-context.svg','Two-panel diagram showing the proposed 3110 South Service Road data-centre site and nearby context','Burlington News diagram'],
      'how-bad-is-burlington-crime':['/assets/editorial/halton-crime-comparison.svg','Chart comparing Halton crime severity with nearby regions','Burlington News chart'],
      'nostalgia-games-cafe-closure':['/assets/editorial/nostalgia-cafe-closure.svg','Editorial illustration of a closed board-game cafe','Burlington News illustration']
    };
    return map[currentSlug] || ['/assets/editorial/home-share.webp','Burlington News','Burlington News'];
  }

  function ensureHero(){
    const main=document.querySelector('main.article');
    const head=main?.querySelector('.article-head');
    if(!main||!head||main.querySelector(':scope > .article-hero')) return;
    const [src,alt,credit]=heroForPath();
    const figure=document.createElement('figure');
    figure.className='article-hero article-hero-generated';
    figure.innerHTML=`<img src="${esc(src)}" alt="${esc(alt)}" loading="eager"><figcaption>${esc(credit)}</figcaption>`;
    head.insertAdjacentElement('afterend',figure);
  }

  function articleText(){
    const source=document.querySelector('.article-body');
    if(!source) return '';
    const clone=source.cloneNode(true);
    clone.querySelectorAll('.sources,.article-share-tools,.article-tip-box,button,script,style').forEach(node=>node.remove());
    return clone.textContent.replace(/\s+/g,' ').trim();
  }

  function addListen(){
    const head=document.querySelector('.article-head');
    if(!head||head.querySelector('.article-listen')) return;
    if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined') return;
    const text=articleText();
    if(!text) return;
    const words=text.split(/\s+/).length;
    const minutes=Math.max(1,Math.round(words/180));
    const wrap=document.createElement('div');
    wrap.className='article-listen';
    wrap.innerHTML=`<button type="button" class="article-listen-main" data-listen-toggle aria-pressed="false"><span aria-hidden="true">▶</span><strong>Listen to this story</strong><small>${minutes} min</small></button><div class="article-listen-more" hidden><button type="button" data-listen-restart>Restart</button><label>Speed <select data-listen-rate><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><span>Uses your browser's voice</span></div>`;
    const byline=head.querySelector('.article-byline,.byline');
    (byline||head.lastElementChild)?.insertAdjacentElement('afterend',wrap);
    const toggle=wrap.querySelector('[data-listen-toggle]');
    const restart=wrap.querySelector('[data-listen-restart]');
    const rate=wrap.querySelector('[data-listen-rate]');
    const more=wrap.querySelector('.article-listen-more');
    let utterance=null;
    let started=false;
    const makeUtterance=()=>{
      const u=new SpeechSynthesisUtterance(text);
      u.rate=Number(rate.value)||1;
      u.onend=()=>{started=false;toggle.setAttribute('aria-pressed','false');toggle.querySelector('span').textContent='▶';toggle.querySelector('strong').textContent='Listen to this story'};
      u.onerror=u.onend;
      return u;
    };
    toggle.addEventListener('click',()=>{
      more.hidden=false;
      if(speechSynthesis.speaking&&!speechSynthesis.paused){speechSynthesis.pause();toggle.setAttribute('aria-pressed','false');toggle.querySelector('span').textContent='▶';toggle.querySelector('strong').textContent='Resume';return}
      if(speechSynthesis.paused){speechSynthesis.resume();toggle.setAttribute('aria-pressed','true');toggle.querySelector('span').textContent='Ⅱ';toggle.querySelector('strong').textContent='Pause';return}
      speechSynthesis.cancel();utterance=makeUtterance();speechSynthesis.speak(utterance);started=true;toggle.setAttribute('aria-pressed','true');toggle.querySelector('span').textContent='Ⅱ';toggle.querySelector('strong').textContent='Pause';
    });
    restart.addEventListener('click',()=>{speechSynthesis.cancel();utterance=makeUtterance();speechSynthesis.speak(utterance);started=true;toggle.setAttribute('aria-pressed','true');toggle.querySelector('span').textContent='Ⅱ';toggle.querySelector('strong').textContent='Pause'});
    rate.addEventListener('change',()=>{if(started||speechSynthesis.speaking||speechSynthesis.paused){speechSynthesis.cancel();utterance=makeUtterance();speechSynthesis.speak(utterance);started=true;toggle.setAttribute('aria-pressed','true');toggle.querySelector('span').textContent='Ⅱ';toggle.querySelector('strong').textContent='Pause'}});
    addEventListener('beforeunload',()=>speechSynthesis.cancel(),{once:true});
  }

  function addShareTools(){
    const head=document.querySelector('.article-head');
    if(!head||head.querySelector('.article-share-tools')) return;
    const tools=document.createElement('div');
    tools.className='article-share-tools';
    tools.innerHTML='<button type="button" data-copy-link>Copy link</button><button type="button" data-share-link>Share</button>';
    const listen=head.querySelector('.article-listen');
    const byline=head.querySelector('.article-byline,.byline');
    (listen||byline||head.lastElementChild)?.insertAdjacentElement('afterend',tools);
    const copy=tools.querySelector('[data-copy-link]');
    const share=tools.querySelector('[data-share-link]');
    const copied=()=>{const old=copy.textContent;copy.textContent='Copied ✓';setTimeout(()=>copy.textContent=old,1400)};
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);copied()}catch(_){const t=document.createElement('textarea');t.value=location.href.split('#')[0];document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();copied()}});
    if(!navigator.share) share.hidden=true;
    else share.addEventListener('click',()=>navigator.share({title:document.title,text:document.querySelector('meta[name="description"]')?.content||'',url:location.href.split('#')[0]}).catch(()=>{}));
  }

  function storyTokens(item){return `${item.label||''} ${item.kind||''} ${item.headline||''}`.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3)}

  async function addRelated(){
    if(document.querySelector('.article-related')) return;
    let payload;
    try{const response=await fetch('/data/story-catalog.json',{cache:'no-store'});if(!response.ok)return;payload=await response.json()}catch(_){return}
    const currentTitle=(document.querySelector('.article-head h1')?.textContent||'').toLowerCase();
    const currentKicker=(document.querySelector('.article-kicker,.eyebrow,.article-head .kicker')?.textContent||'').toLowerCase();
    const currentWords=new Set(`${currentKicker} ${currentTitle}`.split(/[^a-z0-9]+/).filter(word=>word.length>3));
    const items=(payload.items||[]).filter(item=>{const url=String(item.url||'');if(!url||url.startsWith('http'))return false;const slug=url.replace(/^articles\/(?:auto\/)?/,'').replace(/\.html$/,'').replace(/^.*\//,'');return slug&&slug!==currentSlug});
    items.forEach(item=>{const overlap=storyTokens(item).filter(word=>currentWords.has(word)).length;const published=Date.parse(item.published||item.activeFrom||'')||0;item.__related=overlap*20+(Number(item.signals?.interest||item.signals?.novelty||3)*5)+(published?published/1e13:0)+(item.image?8:0)});
    items.sort((a,b)=>b.__related-a.__related);
    const picks=items.slice(0,3);if(!picks.length)return;
    const section=document.createElement('section');section.className='article-related';
    const storyUrl=item=>String(item.url||'').replace(/^articles\/(.+)\.html$/,'/stories/$1/').replace(/^(?!https?:|\/)/,'/');
    section.innerHTML=`<div class="article-related-head"><h2>You might also like…</h2><a href="/news/">All stories →</a></div><div class="article-related-grid">${picks.map(item=>`<a class="article-related-card" href="${esc(storyUrl(item))}"><img src="/${esc(item.image||'assets/editorial/home-share.webp')}" alt="${esc(item.alt||item.headline||'Burlington News')}" loading="lazy"><span>${esc(item.label||'Burlington')}</span><strong>${esc(item.headline)}</strong></a>`).join('')}</div>`;
    document.querySelector('main.article')?.appendChild(section);
  }

  function addTipBox(){
    const body=document.querySelector('.article-body');
    if(!body||body.querySelector('.article-tip-box')) return;
    const box=document.createElement('aside');
    box.className='article-tip-box';
    box.innerHTML='<strong>Know something we should look into?</strong><p>Send Burlington News a tip, correction or local lead.</p><a href="/feedback/">Send a tip →</a>';
    const sources=body.querySelector('.sources');
    if(sources) sources.insertAdjacentElement('beforebegin',box); else body.appendChild(box);
  }

  function addEndCopy(){
    const body=document.querySelector('.article-body');
    if(!body||document.querySelector('.article-share-end'))return;
    const wrap=document.createElement('div');wrap.className='article-share-tools article-share-end';wrap.innerHTML='<button type="button" data-copy-link>Copy link</button><button type="button" data-share-end>Share</button>';body.appendChild(wrap);
    const copy=wrap.querySelector('[data-copy-link]');copy.addEventListener('click',async()=>{const url=location.href.split('#')[0];try{await navigator.clipboard.writeText(url);copy.textContent='Copied ✓';setTimeout(()=>copy.textContent='Copy link',1400)}catch(_){const t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();copy.textContent='Copied ✓';setTimeout(()=>copy.textContent='Copy link',1400)}});
    const share=wrap.querySelector('[data-share-end]');if(!navigator.share)share.hidden=true;else share.addEventListener('click',()=>navigator.share({title:document.title,url:location.href.split('#')[0]}).catch(()=>{}));
  }

  function addReadTime(){
    const byline=document.querySelector('.article-byline,.byline');if(!byline||byline.querySelector('[data-read-time]'))return;
    if(/\b\d+[- ]minute read\b/i.test(byline.textContent)||/\b\d+ min read\b/i.test(byline.textContent))return;
    const words=(document.querySelector('.article-body')?.textContent||'').split(/\s+/).filter(Boolean).length;const minutes=Math.max(1,Math.round(words/220));const stamp=document.createElement('span');stamp.dataset.readTime='1';stamp.textContent=`${minutes} min read`;byline.appendChild(stamp);
  }

  function addSchema(){
    if(document.getElementById('articleStructuredData'))return;
    const title=document.querySelector('.article-head h1')?.textContent?.trim()||document.title;const description=document.querySelector('meta[name="description"]')?.content||'';const image=document.querySelector('.article-hero img')?.src||'https://burlingtonnews.ca/assets/editorial/home-share.webp';const ld=document.createElement('script');ld.id='articleStructuredData';ld.type='application/ld+json';ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:title,description,image:[image],author:{'@type':'Organization',name:'Burlington News'},publisher:{'@type':'NewsMediaOrganization',name:'Burlington News',logo:{'@type':'ImageObject',url:'https://burlingtonnews.ca/logo-mark.png'}},mainEntityOfPage:location.href.split('#')[0]});document.head.appendChild(ld)
  }

  function normalizeArticleMeta(){
    const description=document.querySelector('meta[name="description"]')?.content||'';const title=document.querySelector('.article-head h1')?.textContent?.trim()||document.title.replace(/\s*\|\s*Burlington News.*/,'');const hero=document.querySelector('.article-hero img');const image=hero?.src||'https://burlingtonnews.ca/assets/editorial/home-share.webp';const canonical=document.querySelector('link[rel="canonical"]');const storyPath=currentSlug?`/stories/${currentSlug}/`:location.pathname;if(canonical)canonical.href=`https://burlingtonnews.ca${storyPath}`;const url=(canonical?.href)||location.href.split('#')[0];const metas=[['property','og:site_name','Burlington News'],['property','og:type','article'],['property','og:title',title],['property','og:description',description],['property','og:url',url],['property','og:image',image],['name','twitter:card','summary_large_image'],['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',image]];metas.forEach(([attr,key,value])=>{let node=document.querySelector(`meta[${attr}="${key}"]`);if(!node){node=document.createElement('meta');node.setAttribute(attr,key);document.head.appendChild(node)}node.content=value})
  }

  function boot(){
    lockArticleSearch();ensureHero();addReadTime();addListen();addShareTools();addTipBox();addEndCopy();normalizeArticleMeta();addSchema();document.querySelectorAll('.article-aside').forEach(node=>node.classList.add('article-aside-legacy'));addRelated();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
