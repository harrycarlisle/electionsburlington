(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const dropdown = document.querySelector('.nav-dropdown');
  const today = document.getElementById('today');
  const searchForm = document.getElementById('headerSearch');
  const searchInput = document.getElementById('siteSearch');
  const searchResults = document.getElementById('searchResults');
  const searchPopover = document.getElementById('searchPopover');
  const searchSuggestions = document.getElementById('searchSuggestions');
  const searchClear = document.getElementById('searchClear');
  const latestList = document.getElementById('latestList');
  const weather = document.getElementById('weather');
  const communitySignal = document.getElementById('communitySignal');
  const storyRail = document.getElementById('storyRail');
  const searchIndex = [
    {title:'Ribfest turns 30—with nearly $6 million behind the smoke',url:'articles/ribfest-2026.html',section:'Food · Events',keywords:'barbecue bbq ribs labour day weekend festival'},
    {title:'Why Burlington closes a road for salamanders',url:'articles/salamander-road-closure.html',section:'Wildlife · King Road',keywords:'amphibian migration road closure nature'},
    {title:'What 26,503 fish revealed about Cootes Paradise',url:'articles/fishway-26000-fish.html',section:'Environment · RBG',keywords:'fishway carp marsh water wildlife royal botanical gardens'},
    {title:'The back-to-school dates Burlington families need',url:'articles/back-to-school-2026.html',section:'Schools · September',keywords:'calendar students hdsb school bus'},
    {title:'Ontario nearly replaced the Skyway with three tunnels',url:'articles/skyway-bridge-story.html',section:'Monday Feature · History',keywords:'qew bridge canal engineering hamilton 84 properties 14 minutes'},
    {title:'Ten Burlington food stops worth knowing',url:'guides/best-of-burlington.html#restaurants',section:'Food & drink',keywords:'top food best restaurants corned beef hut dine lunch dinner'},
    {title:'Ten genuinely free things to do',url:'guides/best-of-burlington.html#free',section:'Things to do · Free',keywords:'activities bored weekend parks outdoors'},
    {title:'Burlington 2026 Election Guide',url:'election-guide.html',section:'Elections · Candidates',keywords:'municipal vote mayor councillor trustee politics'},
    {title:'Compare mayoral candidates',url:'head-to-head.html',section:'Elections · Issues',keywords:'head to head differences platforms mayor'},
    {title:'See your Burlington ballot',url:'ballot.html',section:'Elections · Wards',keywords:'ward councillor mayor trustee vote'},
    {title:'Promises and public records',url:'promises.html',section:'Accountability · Elections',keywords:'polimeter tracker kept broken record council'},
    {title:'Elections for beginners',url:'elections-for-beginners.html',section:'Explainer',keywords:'how voting works city region simple'},
    {title:'Shuffle one Burlington idea',url:'explore.html',section:'Things to do',keywords:'explore bored free outside food history passport random'},
    {title:'Live Skyway traffic cameras',url:'skyway-traffic.html',section:'Live tool · QEW',keywords:'traffic commute niagara stoney creek hamilton camera bridge'},
    {title:'Burlington sports',url:'sports.html',section:'Sports',keywords:'soccer lacrosse hockey ringette olympian athletes recreation bayhawks blaze'},
    {title:'Puzzles about Burlington',url:'puzzles.html',section:'Games',keywords:'quiz swipe local knowledge play'}
  ];
  const suggestedSearches = ['top food','elections','things to do','this weekend',"I'm bored"];

  if (today) {
    const date = new Intl.DateTimeFormat('en-CA', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(new Date());
    today.textContent = `Burlington, Ontario · ${date}`;
  }

  if (menu && nav) {
    const close = () => {
      nav.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open menu');
    };
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        dropdown?.removeAttribute('open');
        close();
        menu.focus();
      }
    });
  }

  document.addEventListener('click', event => {
    if (dropdown?.open && !dropdown.contains(event.target)) dropdown.removeAttribute('open');
  });

  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {bored:'explore things to do free activities',weekend:'events things to do ribfest',restaurant:'food dine',restaurants:'food dine',vote:'elections ballot',voting:'elections ballot',traffic:'skyway qew camera',sports:'soccer lacrosse hockey ringette athletes'};
  const rankedSearch = query => {
    const clean = normalize(query);
    if (!clean) return searchIndex.slice(0, 6);
    const rawTerms = clean.split(/\s+/).filter(Boolean);
    const terms = [...new Set(rawTerms.flatMap(term => [term, ...(aliases[term] || '').split(/\s+/).filter(Boolean)]))];
    return searchIndex.map(item => {
      const title = normalize(item.title), section = normalize(item.section), keywords = normalize(item.keywords);
      let score = title === clean ? 160 : title.startsWith(clean) ? 90 : 0;
      rawTerms.forEach(term => {if (title.includes(term)) score += 32;if (section.includes(term)) score += 18;if (keywords.includes(term)) score += 12;});
      terms.forEach(term => {if (!rawTerms.includes(term) && (title.includes(term) || section.includes(term) || keywords.includes(term))) score += 3;});
      return {item,score};
    }).filter(result => result.score > 0).sort((a,b) => b.score - a.score).map(result => result.item);
  };
  const openSearch = () => {
    if (!searchPopover || !searchInput) return;
    searchPopover.hidden = false;
    searchInput.setAttribute('aria-expanded','true');
  };
  const closeSearch = () => {
    if (!searchPopover || !searchInput) return;
    searchPopover.hidden = true;
    searchInput.setAttribute('aria-expanded','false');
  };
  const renderSearch = query => {
    if (!searchResults) return;
    const matches = rankedSearch(query);
    searchResults.innerHTML = matches.length
      ? matches.slice(0, 7).map(item => `<a role="option" href="${item.url}"><span>${item.section}</span><strong>${item.title}</strong></a>`).join('')
      : '<p>No exact match. Try “food,” “elections,” “Skyway” or “free.”</p>';
    if (searchClear) searchClear.hidden = !query;
  };
  if (searchSuggestions) searchSuggestions.innerHTML = suggestedSearches.map(term => `<button type="button" data-search="${term.replace(/"/g,'&quot;')}">${term}</button>`).join('');
  searchSuggestions?.addEventListener('click', event => {
    const button = event.target.closest('[data-search]');
    if (!button || !searchInput) return;
    searchInput.value = button.dataset.search;
    renderSearch(searchInput.value);
    searchInput.focus();
  });
  searchInput?.addEventListener('focus', () => {openSearch();renderSearch(searchInput.value);});
  searchInput?.addEventListener('input', event => {openSearch();renderSearch(event.target.value);});
  searchClear?.addEventListener('click', () => {if (!searchInput) return;searchInput.value='';renderSearch('');searchInput.focus();});
  searchForm?.addEventListener('submit', event => {event.preventDefault();const first=searchResults?.querySelector('a');if(first) location.href=first.href;});
  document.addEventListener('click', event => {if (searchForm && !searchForm.contains(event.target)) closeSearch();});
  document.addEventListener('keydown', event => {if(event.key==='Escape'&&searchPopover&&!searchPopover.hidden){closeSearch();searchInput?.blur();}});
  if (searchInput && new URLSearchParams(location.search).get('search') === '1') {
    history.replaceState(null, '', location.pathname);
    requestAnimationFrame(() => { searchInput.focus(); openSearch(); renderSearch(''); });
  }
  if (searchInput && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let prompt = 0;
    setInterval(() => {if (document.activeElement !== searchInput && !searchInput.value) {prompt=(prompt+1)%suggestedSearches.length;searchInput.placeholder=`Search “${suggestedSearches[prompt]}”`; }}, 3200);
  }

  const weatherLabel = code => code === 0 ? 'Clear' : code <= 3 ? 'Cloudy' : code === 45 || code === 48 ? 'Fog' : code <= 67 || (code >= 80 && code <= 82) ? 'Rain' : code <= 77 || (code >= 85 && code <= 86) ? 'Snow' : code >= 95 ? 'Thunderstorm' : 'Weather';
  const weatherIcon = code => {
    if (code === 0) return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/></svg>';
    if (code >= 95) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16.5a4 4 0 1 1 1.2-7.8A5.5 5.5 0 0 1 18.2 10a3.4 3.4 0 0 1-.7 6.5H6.5Z"/><path d="m12 15-2 4h2l-1 3 4-5h-2l1-2"/></svg>';
    if (code <= 3) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 17a4.2 4.2 0 0 1 .8-8.3A5.7 5.7 0 0 1 18 10.2 3.5 3.5 0 0 1 17.2 17h-11Z"/></svg>';
    if (code <= 67 || (code >= 80 && code <= 82)) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 14.8a4.2 4.2 0 0 1 .8-8.3A5.7 5.7 0 0 1 18 8a3.5 3.5 0 0 1-.8 6.8h-11Z"/><path d="m8 18-1 2M13 18l-1 2M18 18l-1 2"/></svg>';
    if (code <= 77 || (code >= 85 && code <= 86)) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 14.5a4.2 4.2 0 0 1 .8-8.3A5.7 5.7 0 0 1 18 7.7a3.5 3.5 0 0 1-.8 6.8h-11Z"/><circle cx="8" cy="19" r=".8"/><circle cx="13" cy="18" r=".8"/><circle cx="18" cy="20" r=".8"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M3 13h15M7 17h13"/></svg>';
  };
  if (weather) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=temperature_2m,weather_code&temperature_unit=celsius', {signal: controller.signal})
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        const current = data.current || {};
        if (!Number.isFinite(current.temperature_2m)) return;
        const code=Number(current.weather_code), label=weatherLabel(code), temperature=Math.round(current.temperature_2m);
        weather.innerHTML = `${weatherIcon(code)}<strong>${temperature}°</strong><span class="sr-only">${label}</span>`;
        weather.setAttribute('aria-label',`${temperature} degrees Celsius, ${label}`);
        weather.hidden = false;
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  const leadStory = document.getElementById('leadStory');
  const leadMedia = document.getElementById('leadMedia');
  const leadTitle = document.getElementById('lead-title');
  const leadLabel = document.getElementById('leadLabel');
  const leadDeck = document.getElementById('leadDeck');
  const leadByline = document.getElementById('leadByline');
  const heroProgress = document.getElementById('heroProgress');
  const heroLibrary = [
    {id:'skyway-tunnels',url:'articles/skyway-bridge-story.html',label:'The Monday Feature · 9 min',title:'Ontario nearly replaced the Skyway with three tunnels.',deck:'A ship strike, failed tolls, 84 purchased properties—and a crash 14 minutes after the second span opened.',byline:'By Burlington News Staff',media:'<img src="assets/home/skyway.webp" width="1000" height="625" alt="The Burlington Bay James N. Allan Skyway" fetchpriority="high" decoding="async"><span class="image-credit">Dave Lauretti · CC BY 2.0</span>'},
    {id:'election-field-2026',url:'election-guide.html#candidates',label:'2026 municipal election',title:'Five people want to lead Burlington. Start with their biggest differences.',deck:'Compare their plans, records and unanswered questions without campaign spin.',byline:'By the Burlington News Election Desk',media:'<div class="lead-candidate-montage" aria-label="Four verified candidate photos and one candidate placeholder"><img src="assets/candidates/mw.webp" alt="Marianne Meed Ward"><img src="assets/candidates/lk.webp" alt="Lisa Kearns"><img src="assets/candidates/rn.webp" alt="Rory Nisan"><img src="assets/candidates/yr.webp" alt="Yazid Razak"><span aria-label="No verified public photo for Keith Demoe">KD</span></div>'},
    {id:'ribfest-2026',url:'articles/ribfest-2026.html',label:'Labour Day weekend',title:'Ribfest turns 30—with nearly $6 million behind the smoke.',deck:'How a Burlington fundraiser grew into a four-day ritual—and where the money goes.',byline:'By Burlington News Staff',media:'<img src="assets/home/ribs.webp" width="1000" height="625" alt="Barbecue ribs smoking over a pit" loading="eager" decoding="async"><span class="image-credit">Thogru · CC BY-SA 3.0</span>'}
  ];
  let heroStories = [...heroLibrary];
  let heroIndex=0, heroTimer;
  const paintHero = index => {
    if (!leadStory || !leadMedia || !leadTitle || !leadLabel || !leadDeck || !leadByline) return;
    heroIndex=(index+heroStories.length)%heroStories.length;
    const story=heroStories[heroIndex];
    leadStory.classList.add('is-changing');
    window.setTimeout(()=>{leadStory.href=story.url;leadMedia.innerHTML=story.media;leadLabel.textContent=story.label;leadTitle.textContent=story.title;leadDeck.textContent=story.deck;leadByline.textContent=story.byline;heroProgress?.querySelectorAll('button').forEach((button,i)=>button.classList.toggle('active',i===heroIndex));heroProgress?.setAttribute('aria-label',`Featured story ${heroIndex+1} of ${heroStories.length}`);leadStory.classList.remove('is-changing');},120);
  };
  const bindProgress = () => {
    if (!heroProgress) return;
    heroProgress.innerHTML = heroStories.map((_, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" aria-label="Show feature ${index + 1}"></button>`).join('');
    heroProgress.querySelectorAll('button').forEach((button,index)=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();paintHero(index);startHero();}));
  };
  const startHero = () => {if(heroStories.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches)return;clearInterval(heroTimer);heroTimer=setInterval(()=>paintHero(heroIndex+1),12000);};
  bindProgress();
  leadStory?.addEventListener('mouseenter',()=>clearInterval(heroTimer));leadStory?.addEventListener('mouseleave',startHero);leadStory?.addEventListener('focusin',()=>clearInterval(heroTimer));leadStory?.addEventListener('focusout',startHero);startHero();

  const safeText = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  let rankedLatestApplied = false;
  fetch('data/home-surface.json', {cache: 'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      const selected = (data.feature || []).map(item => heroLibrary.find(story => story.id === item.id)).filter(Boolean);
      if (selected.length) {
        heroStories = selected;
        heroIndex = 0;
        bindProgress();
        paintHero(0);
        startHero();
      }
      if (storyRail && Array.isArray(data.rail) && data.rail.length) {
        storyRail.innerHTML = data.rail.slice(0, 3).map(item => {
          const external = /^https?:\/\//.test(item.url || '');
          const label = item.labelEssential && item.label ? `<span class="story-label">${safeText(item.label)}</span>` : '';
          return `<a class="side-story" href="${safeText(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}><img src="${safeText(item.image)}" alt="${safeText(item.alt || '')}" loading="lazy" decoding="async"><div>${label}<h2>${safeText(item.headline)}</h2></div></a>`;
        }).join('');
      }
      if (latestList && Array.isArray(data.latest) && data.latest.length) {
        latestList.innerHTML = data.latest.slice(0, 3).map(item => {
          const external = /^https?:\/\//.test(item.url || '');
          const visual = item.image
            ? `<img class="latest-thumb" src="${safeText(item.image)}" alt="${safeText(item.alt || '')}" loading="lazy" decoding="async">`
            : '<span class="latest-thumb latest-thumb-sport" aria-hidden="true">BN</span>';
          const label = item.labelEssential && item.label ? `<span>${safeText(item.label)}</span>` : '';
          return `<a class="${label ? '' : 'no-label'}" href="${safeText(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${visual}${label}<strong>${safeText(item.headline)}</strong>${item.deck ? `<small>${safeText(item.deck)}</small>` : ''}</a>`;
        }).join('');
        rankedLatestApplied = true;
      }
    })
    .catch(() => {});
  fetch('data/daily-brief.json', {cache: 'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (rankedLatestApplied) return;
      const blocked = /^(list of candidates|for candidates|candidate financials|candidate news and updates|infrastructure and growth|water and wastewater services|low water.*)$/i;
      const editorial = item => {
        const headline = String(item.headline || '').replace(/\s+/g, ' ').trim();
        const summary = String(item.summary || '').replace(/\s+/g, ' ').trim();
        const words = headline.split(/\s+/).filter(Boolean);
        const repeated = /(\b\w+\b)(?:\s+\1){2,}/i.test(headline);
        const repeatsMainStory = /candidate/i.test(String(item.tag || ''));
        return item.url && !blocked.test(headline) && !repeatsMainStory && words.length >= 6 && words.length <= 18 && summary.length >= 45 && summary.toLowerCase() !== headline.toLowerCase() && !repeated;
      };
      const stories = (data.items || []).filter(editorial).slice(0, 3);
      if (!latestList || stories.length < 3) return;
      const visual = item => {
        const text = `${item.tag || ''} ${item.headline || ''}`.toLowerCase();
        if (/fish|marsh|environment/.test(text)) return '<img class="latest-thumb" src="assets/home/fishway.webp" width="160" height="110" alt="The Cootes Paradise Fishway across the water" loading="lazy" decoding="async">';
        if (/ward|boundary/.test(text)) return '<span class="latest-thumb latest-thumb-wards" aria-hidden="true"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i></span>';
        if (/sport|soccer|hockey|ringette|recreation/.test(text)) return '<span class="latest-thumb latest-thumb-sport" aria-hidden="true">GO</span>';
        return `<span class="latest-thumb latest-thumb-sport" aria-hidden="true">${safeText(String(item.tag || 'BN').slice(0, 2).toUpperCase())}</span>`;
      };
      latestList.innerHTML = stories.map(item => {
        const showLabel = Number(item.importance || 0) >= 4 || /election|developing|live|school|labour day/i.test(String(item.tag || ''));
        return `<a class="${showLabel ? '' : 'no-label'}" href="${safeText(item.url)}"${/^https?:\/\//.test(item.url) ? ' target="_blank" rel="noopener"' : ''}>${visual(item)}${showLabel ? `<span>${safeText(item.tag || 'Burlington')}</span>` : ''}<strong>${safeText(item.headline)}</strong><small>${safeText(item.summary || '')}</small></a>`;
      }).join('');
    })
    .catch(() => {});

  fetch('data/community-pulse.json', {cache: 'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      const item = data?.status === 'available' ? data.item : null;
      if (!communitySignal || !item?.title || !item?.url) return;
      const link = document.getElementById('communitySignalLink');
      const headline = document.getElementById('communitySignalHeadline');
      const meta = document.getElementById('communitySignalMeta');
      const checked = data.checkedAt ? new Date(data.checkedAt) : null;
      const time = checked && !Number.isNaN(checked.valueOf()) ? new Intl.DateTimeFormat('en-CA', {hour:'numeric',minute:'2-digit'}).format(checked) : 'recently';
      link.href = item.url;
      headline.textContent = item.title;
      meta.textContent = `${item.source} · checked ${time}`;
      communitySignal.hidden = false;
    })
    .catch(() => {});
})();
