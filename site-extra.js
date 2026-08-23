(() => {
  const root = document.documentElement;
  const storageKey = 'burlington-election-theme';

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function themeIcon(theme) {
    return theme === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.7 8.7 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only">Dark mode</span>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Light mode</span>';
  }

  function setTheme(theme, persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      button.innerHTML = themeIcon(next);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
    if (persist) try { localStorage.setItem(storageKey, next); } catch (_) {}
  }

  function isHomePage() {
    const p = location.pathname;
    return p === '/' || p.endsWith('/index.html');
  }

  function homeLink(hash) { return isHomePage() ? hash : `index.html${hash}`; }

  function ensureStyle(href, key) {
    if (document.querySelector(`link[data-style="${key}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.style = key;
    document.head.appendChild(link);
  }

  function ensureExtraStyles() {
    ensureStyle('dates-extra.css?v=20260823d', 'dates');
    ensureStyle('header-controls.css?v=20260823c', 'header');
    ensureStyle('polish-v2.css?v=20260823b', 'polish');
    ensureStyle('candidate-cleanup.css?v=20260823b', 'candidate-cleanup');
    ensureStyle('branding-v3.css?v=20260823b', 'branding');
    ensureStyle('ux-v4.css?v=20260823a', 'ux-v4');
    ensureStyle('ux-v5.css?v=20260823a', 'ux-v5');
  }

  function addSeo() {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `https://electionsburlington.ca${location.pathname === '/' ? '/' : location.pathname}`;
    if (!document.querySelector('link[rel="canonical"]')) document.head.appendChild(canonical);

    const metas = [
      ['og:type','website'],
      ['og:site_name','Burlington Election Guide'],
      ['og:locale','en_CA'],
      ['og:title', document.title || '2026 Burlington Ontario Mayoral Election Guide'],
      ['og:description','Independent, plain-language guide to the 2026 Burlington, Ontario mayoral election, candidates, issues, records and voting dates.'],
      ['og:url', canonical.href],
      ['twitter:card','summary_large_image']
    ];
    metas.forEach(([property, content]) => {
      if (document.querySelector(`meta[property="${property}"],meta[name="${property}"]`)) return;
      const m = document.createElement('meta');
      if (property.startsWith('twitter:')) m.name = property; else m.setAttribute('property', property);
      m.content = content; document.head.appendChild(m);
    });

    if (!document.getElementById('electionStructuredData')) {
      const ld = document.createElement('script');
      ld.id = 'electionStructuredData'; ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context':'https://schema.org',
        '@type':'WebSite',
        name:'Burlington Election Guide',
        url:'https://electionsburlington.ca/',
        description:'Independent guide to the 2026 Burlington, Ontario, Canada mayoral election.',
        inLanguage:'en-CA',
        about:{'@type':'Thing',name:'2026 Burlington Ontario mayoral election'}
      });
      document.head.appendChild(ld);
    }
  }

  const icons = {
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.8 9a2.35 2.35 0 1 1 3.3 2.15c-.75.35-1.1.8-1.1 1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.7" r="1" fill="currentColor"/></svg>',
    feedback:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  function buildDrawer(nav) {
    nav.classList.add('menu-panel');
    nav.innerHTML = `
      <div class="menu-panel-head"><span>Explore the guide</span></div>
      <div class="menu-primary" role="list">
        <a class="menu-link" role="listitem" href="${homeLink('#candidates')}"><span>Candidates</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#matters')}"><span>Issues</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="head-to-head.html"><span>Head-to-head</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#dates')}"><span>Important dates</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#method')}"><span>Sources & methodology</span><span aria-hidden="true">›</span></a>
      </div>
      <div class="menu-separator" aria-hidden="true"></div>
      <div class="menu-support" role="list">
        <a class="menu-support-link" role="listitem" href="help.html"><span class="menu-support-icon">${icons.help}</span><span>Help</span></a>
        <a class="menu-support-link" role="listitem" href="/feedback/"><span class="menu-support-icon">${icons.feedback}</span><span>Give feedback</span></a>
      </div>`;
  }

  function prepareHeaderForMenu() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;
    headerInner.querySelector('.back')?.remove();
    let nav = document.getElementById('mainNav');
    if (!nav) { nav = document.createElement('nav'); nav.className='nav'; nav.id='mainNav'; nav.setAttribute('aria-label','Primary'); headerInner.appendChild(nav); }
    if (!document.getElementById('menuBtn')) {
      const b=document.createElement('button'); b.type='button'; b.className='menu'; b.id='menuBtn'; b.setAttribute('aria-controls','mainNav'); b.setAttribute('aria-expanded','false'); b.textContent='Menu'; headerInner.appendChild(b);
    }
  }

  function enhanceMenu() {
    const oldMenu=document.getElementById('menuBtn'), nav=document.getElementById('mainNav');
    if(!oldMenu||!nav) return;
    const menu=oldMenu.cloneNode(false);
    menu.className='menu menu-icon-button'; menu.setAttribute('aria-label','Open site menu'); menu.setAttribute('aria-expanded','false');
    menu.innerHTML='<span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">Menu</span>';
    oldMenu.replaceWith(menu);
    const theme=document.createElement('button'); theme.type='button'; theme.className='theme-icon-button'; theme.dataset.themeToggle='';
    theme.addEventListener('click',e=>{e.stopPropagation();setTheme(root.dataset.theme==='dark'?'light':'dark')});
    const controls=document.createElement('div'); controls.className='header-controls'; menu.parentElement.insertBefore(controls,menu); controls.append(theme,menu);
    buildDrawer(nav);
    const close=(focus=false)=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open site menu');document.body.classList.remove('menu-is-open');if(focus)menu.focus()};
    menu.addEventListener('click',e=>{e.stopPropagation();const open=!nav.classList.contains('open');if(open){nav.classList.add('open');menu.setAttribute('aria-expanded','true');menu.setAttribute('aria-label','Close site menu');document.body.classList.add('menu-is-open');requestAnimationFrame(()=>nav.querySelector('a')?.focus())}else close()});
    nav.addEventListener('click',e=>e.stopPropagation()); nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>close()));
    document.addEventListener('click',()=>close()); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open'))close(true)});
  }

  function candidateDataFromCards() {
    return [...document.querySelectorAll('#candidateStrip .candidate-card')].map((card,index)=>({
      card,index,name:card.querySelector('h3')?.textContent.trim()||`Candidate ${index+1}`,
      img:card.querySelector('img')?.src||'', initials:(card.querySelector('h3')?.textContent||'').split(/\s+/).map(x=>x[0]).join('').slice(0,2)
    }));
  }

  function buildHero() {
    const candidates=document.getElementById('candidates'), main=document.getElementById('main');
    if(!candidates||!main||document.querySelector('.election-hero')) return;
    document.body.classList.add('landing-home');
    candidates.querySelector(':scope > .eyebrow')?.remove(); candidates.querySelector(':scope > .section-intro')?.remove(); candidates.querySelector(':scope > .section-deck')?.remove();
    const old=candidates.querySelector(':scope > h1'); if(old){const h=document.createElement('h2');h.textContent='Meet the candidates';old.replaceWith(h)}
    const people=candidateDataFromCards();
    const hero=document.createElement('section'); hero.className='election-hero'; hero.setAttribute('aria-labelledby','heroTitle');
    hero.innerHTML=`<div class="hero-copy"><h1 id="heroTitle">Burlington's mayoral election, explained.</h1><div class="hero-actions"><a class="hero-button hero-button-primary" href="head-to-head.html">Compare candidates <span aria-hidden="true">→</span></a><a class="hero-button hero-button-secondary" href="#candidates">Browse candidates</a></div><div class="hero-trust"><span>Independent</span><span>No endorsements</span><span>Sources linked</span></div></div><div class="hero-visual" aria-hidden="true"><div class="hero-map-card"><div class="hero-place-dot"></div><div class="hero-candidate-slide" id="heroCandidateSlide"></div><div class="hero-date-card"><span>Election day</span><strong>OCT 26</strong><small>2026</small></div><div class="hero-voting-note"><span>Voting starts</span><strong>Oct. 14</strong></div><div class="map-credit">Map © OpenStreetMap contributors</div></div></div>`;
    main.insertBefore(hero,candidates);
    const slide=hero.querySelector('#heroCandidateSlide'); let i=0;
    const paint=()=>{if(!people.length)return;const p=people[i%people.length];slide.classList.add('is-changing');setTimeout(()=>{slide.innerHTML=p.img?`<img src="${p.img}" alt=""><span>${p.name}</span>`:`<span class="hero-candidate-initials">${p.initials}</span><span>${p.name}</span>`;slide.classList.remove('is-changing')},140)};
    paint(); if(!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(()=>{i=(i+1)%people.length;paint()},3200);
  }

  function setupCandidateScrollSelection() {
    const strip=document.getElementById('candidateStrip'); if(!strip) return;
    let timer=null, internal=false;
    const canScroll=()=>strip.scrollWidth>strip.clientWidth+6;
    const selectNearest=()=>{
      if(!canScroll()||internal) return;
      const cards=[...strip.querySelectorAll('.candidate-card')]; if(!cards.length)return;
      const center=strip.getBoundingClientRect().left+strip.clientWidth/2;
      let best=cards[0],dist=Infinity; cards.forEach(c=>{const r=c.getBoundingClientRect();const d=Math.abs((r.left+r.width/2)-center);if(d<dist){dist=d;best=c}});
      if(best.getAttribute('aria-pressed')!=='true'){internal=true;best.click();setTimeout(()=>internal=false,100)}
    };
    strip.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(selectNearest,90)},{passive:true});
    strip.addEventListener('scrollend',selectNearest,{passive:true});
    strip.querySelectorAll('.candidate-card').forEach(card=>card.addEventListener('click',()=>{if(!canScroll())return;requestAnimationFrame(()=>card.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}))}));
  }

  function upgradeDates() {
    const section=document.querySelector('section.dates#dates'); if(!section||section.classList.contains('dates-upgraded'))return;
    const heading=section.querySelector('h2'),grid=section.querySelector('.date-grid'); if(!heading||!grid)return;
    section.classList.add('dates-upgraded'); const row=document.createElement('div');row.className='dates-heading-row';const copy=document.createElement('div');copy.className='dates-heading-copy';const accent=document.createElement('div');accent.className='dates-heading-accent';heading.textContent='Important dates';copy.append(heading,accent);row.append(copy);section.insertBefore(row,grid);
    const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
    const entries=[['2026-09-17'],['2026-10-14','2026-10-23'],['2026-10-17','2026-10-20'],['2026-10-26']];
    [...grid.querySelectorAll('.date-card')].forEach((card,index)=>{const raw=card.querySelector('.date')?.textContent||'',title=card.querySelector('h3')?.textContent||'',desc=card.querySelector('p')?.textContent||'';const [startS,endS]=entries[index];const start=new Date(startS+'T12:00:00'),end=endS?new Date(endS+'T12:00:00'):null;let status;const days=Math.round((start-today)/86400000);if(end&&today>=start&&today<=end){const remain=Math.round((end-today)/86400000);status=remain===0?'Ends today':`Ends in ${remain} days`}else if(days===0)status='Today';else if(days===1)status='Tomorrow';else if(days<0)status='Finished';else status=`In ${days} days`;const parts=raw.replace('Sept.','SEP').replace('Oct.','OCT').split(' ');card.className='card date-card date-stop'+(index===0?' is-next':'');card.innerHTML=`<div class="date-stop-top"><div class="date-calendar"><span class="date-calendar-month">${parts[0]}</span><span class="date-calendar-day">${parts.slice(1).join(' ')}</span></div><span class="date-status">${status}</span></div><div class="date-stop-body"><h3>${title}</h3><p>${desc}</p></div>`});
  }

  function simplifyMainPage(){document.querySelector('.site-independent-note')?.remove();document.querySelector('.footer')?.remove();document.querySelectorAll('.meaning-detail summary,.plain summary').forEach(s=>{if(/what does that mean/i.test(s.textContent))s.textContent='In plain English'})}

  function polishHeadToHead(){if(!document.querySelector('.match-grid'))return;document.body.classList.add('h2h-polished');document.querySelector('.head p')?.remove();document.querySelector('.back')?.remove();const context=document.getElementById('context');const issue=document.getElementById('issue');const apply=()=>{const h=context?.querySelector('h2');if(h)h.textContent='Context';};apply();issue?.addEventListener('change',()=>setTimeout(apply,0))}

  function improvePageStructure(){const brand=document.querySelector('.brand');if(brand)brand.href='index.html';document.querySelectorAll('section').forEach(s=>{const h=s.querySelector('h2');if(h&&!s.classList.contains('election-hero'))h.classList.add('section-title')})}

  function ensureFooter(){let f=document.querySelector('.site-legal-footer');if(!f){f=document.createElement('footer');f.className='site-legal-footer';document.body.appendChild(f)}f.innerHTML='<div class="site-legal-footer-inner"><div class="footer-brand-block"><strong>Burlington Election Guide</strong><p>Independent civic project. Not affiliated with the City of Burlington, any candidate or campaign.</p></div><nav class="site-legal-links" aria-label="Legal and accessibility"><a href="help.html#accessibility">Accessibility</a><a href="terms.html">Terms of use</a><a href="privacy.html">Privacy policy</a></nav></div>'}

  setTheme(preferredTheme(),false);
  document.addEventListener('DOMContentLoaded',()=>{
    ensureExtraStyles(); addSeo(); buildHero(); upgradeDates(); simplifyMainPage(); polishHeadToHead(); improvePageStructure(); prepareHeaderForMenu(); enhanceMenu(); setupCandidateScrollSelection(); ensureFooter(); setTheme(root.dataset.theme||preferredTheme(),false);
  });
})();