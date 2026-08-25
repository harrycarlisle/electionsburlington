(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const searchForm = document.getElementById('headerSearch');
  const searchInput = document.getElementById('siteSearch');
  const searchResults = document.getElementById('searchResults');
  const searchPopover = document.getElementById('searchPopover');
  const searchSuggestions = document.getElementById('searchSuggestions');
  const latestList = document.getElementById('latestList');
  const root = document.documentElement;
  const themeKey = 'burlington-news-theme';
  const cleanDash = value => String(value || '').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const relativeDate = value => {
    const date = new Date(value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-04:00` : value);
    if (!Number.isFinite(date.getTime())) return 'Recently added';
    const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
    if (hours < 1) return 'Less than an hour ago';
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };
  const categoryLabel = item => {
    const haystack = `${item?.label || ''} ${item?.tag || ''} ${item?.kind || ''} ${item?.headline || ''}`.toLowerCase();
    if (/election|ward|vote|candidate|ballot/.test(haystack)) return 'Election';
    if (/school|student|teacher|back to school/.test(haystack)) return 'Schools';
    if (/development|brant|building|housing|millcroft|zoning|construction/.test(haystack)) return 'Development';
    if (/traffic|qew|skyway|road|closure/.test(haystack)) return 'Traffic';
    if (/sport|soccer|hockey|ringette|lacrosse/.test(haystack)) return 'Sports';
    if (/food|restaurant|ribfest|taco/.test(haystack)) return 'Food';
    if (/event|festival|weekend/.test(haystack)) return 'Events';
    if (/fish|wildlife|nature|salamander|marsh|park|quarry/.test(haystack)) return 'Nature';
    return 'Burlington';
  };

  const searchIndex = [
    {title:'Ontario nearly replaced the Skyway with three tunnels',url:'articles/skyway-bridge-story.html',section:'Feature',keywords:'skyway bridge canal qew tunnels'},
    {title:'Millcroft Phase 2 proposes 138 homes',url:'articles/millcroft-phase-2-138-homes.html',section:'Development',keywords:'millcroft golf course homes development ward 6'},
    {title:'What the Nelson Quarry decision means for Burlington',url:'articles/nelson-quarry-tribunal-decision.html',section:'Development',keywords:'nelson quarry mount nemo escarpment olt'},
    {title:'Upper Middle Road construction: what changes next',url:'articles/upper-middle-road-construction-2026.html',section:'Roads',keywords:'upper middle road watermain construction guelph line'},
    {title:'A bat in Burlington tested positive for rabies',url:'articles/burlington-rabies-bat-2026.html',section:'Public health',keywords:'rabies bat halton public health'},
    {title:'Ribfest turns 30',url:'articles/ribfest-2026.html',section:'Events',keywords:'ribfest ribs labour day food festival'},
    {title:'The school dates Burlington families need',url:'articles/back-to-school-2026.html',section:'Schools',keywords:'school calendar hdsb September'},
    {title:'What Ontario students can actually be searched for',url:'articles/ontario-student-rights-school.html',section:'Schools',keywords:'teacher phone detention bag locker search student rights school'},
    {title:'730 Brant sat empty for more than a decade, then caught fire',url:'articles/730-brant-vacant-building.html',section:'Development',keywords:'abandoned vacant building fire Brant Street owner redevelopment'},
    {title:'Explore Burlington',url:'explore.html',section:'Explore',keywords:'this weekend bored passport calendar places free farmers market'},
    {title:'Burlington food spots worth trying',url:'guides/burlington-food-spots.html',section:'Food',keywords:'best food tacos burger sandwich banh mi coffee restaurants'},
    {title:'Burlington 2026 Election Guide',url:'election-guide.html',section:'Election',keywords:'vote mayor candidates ward ballot'},
    {title:'Burlington sports',url:'sports.html',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette'},
    {title:'Games about Burlington',url:'puzzles.html',section:'Games',keywords:'quiz puzzle trivia swipe'},
    {title:'Live Skyway traffic cameras',url:'skyway-traffic.html',section:'Traffic',keywords:'qew skyway traffic camera commute'}
  ];
  const suggested = ['This Weekend','I’m bored','Best Food','Best Tacos'];

  const setTheme = (theme,persist=true) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const target = next === 'dark' ? 'Light mode' : 'Dark mode';
      toggle.textContent = target;
      toggle.setAttribute('aria-label',`Switch to ${target.toLowerCase()}`);
    }
    if (persist) try { localStorage.setItem(themeKey,next); } catch (_) {}
  };
  setTheme(root.dataset.theme || 'light',false);

  const rotatingPrompts = ['Search This Weekend','Search “I’m bored”','Search Best Food','Search Best Tacos','Search the election'];
  if (searchInput && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let promptIndex = 0;
    const rotatePrompt = () => {
      if (document.activeElement !== searchInput && !searchInput.value) {
        searchInput.placeholder = rotatingPrompts[promptIndex % rotatingPrompts.length];
        promptIndex += 1;
      }
    };
    rotatePrompt();
    window.setInterval(rotatePrompt,2600);
  }

  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav?.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menu?.setAttribute('aria-expanded','false');
  }));

  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  function ranked(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return searchIndex.slice(0,7);
    return searchIndex.map(item => {
      const title = normalize(item.title);
      const text = normalize(`${item.section} ${item.keywords}`);
      const score = terms.reduce((sum,term) => sum + (title.includes(term) ? 30 : 0) + (text.includes(term) ? 10 : 0),0);
      return {item,score};
    }).filter(result => result.score).sort((a,b) => b.score - a.score).map(result => result.item);
  }
  function renderSearch(query) {
    const matches = ranked(query);
    searchResults.innerHTML = matches.length ? matches.slice(0,7).map(item => `<a role="option" href="${esc(item.url)}"><span>${esc(item.section)}</span><strong>${esc(item.title)}</strong></a>`).join('') : '<p>No exact match. Try “Skyway,” “events” or “food.”</p>';
    searchPopover.hidden = false;
    searchInput.setAttribute('aria-expanded','true');
  }
  if (searchSuggestions) searchSuggestions.innerHTML = suggested.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');
  searchSuggestions?.addEventListener('click', event => { const button = event.target.closest('[data-search]'); if (!button) return; searchInput.value = button.dataset.search; renderSearch(searchInput.value); });
  searchInput?.addEventListener('focus', () => renderSearch(searchInput.value));
  searchInput?.addEventListener('input', () => renderSearch(searchInput.value));
  searchForm?.addEventListener('submit', event => { event.preventDefault(); const first = searchResults?.querySelector('a'); if (first) location.href = first.href; });
  document.addEventListener('click', event => { if (searchForm && !searchForm.contains(event.target)) { searchPopover.hidden = true; searchInput.setAttribute('aria-expanded','false'); } });
  document.addEventListener('keydown', event => { if (event.key !== 'Escape') return; nav?.classList.remove('is-open'); searchPopover.hidden = true; });

  if (searchInput && new URLSearchParams(location.search).get('search') === '1') requestAnimationFrame(() => { searchInput.focus(); renderSearch(''); history.replaceState(null,'',location.pathname); });

  fetch('data/home-surface.json',{cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (!latestList || !Array.isArray(data.latest) || !data.latest.length) return;
      latestList.innerHTML = data.latest.slice(0,3).map(item => {
        const external = /^https?:\/\//.test(item.url || '');
        return `<a href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}><span><small>${esc(categoryLabel(item))}</small><strong>${esc(item.headline)}</strong><time>${esc(relativeDate(item.published || item.activeFrom))}</time></span></a>`;
      }).join('');
    }).catch(() => {});

  const lead = document.querySelector('.top-story');
  const leadImages = {
    'Your ward': ['assets/editorial/burlington-wards-2026.svg', 'Diagram of Burlington municipal wards', 'Burlington News diagram'],
    'Traffic': ['assets/home/skyway-reader.webp', 'The Burlington Bay Skyway across Burlington Bay', 'Photo provided to Burlington News']
  };
  fetch('data/daily-brief.json',{cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (!lead || !Array.isArray(data.items)) return;
      const now = new Date();
      const item = data.items.find(entry => {
        const published = new Date(`${entry.date}T00:00:00-04:00`);
        return entry.importance >= 4 && now - published < 48 * 60 * 60 * 1000 && ['primary','reported'].includes(entry.verificationTier);
      });
      if (!item) return;
      const visual = leadImages[item.tag] || leadImages['Your ward'];
      const external = /^https?:\/\//.test(item.url || '');
      lead.innerHTML = `<a href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="top-image"><img src="${visual[0]}" width="1600" height="1000" alt="${esc(visual[1])}" fetchpriority="high"><span class="image-credit">${esc(visual[2])}</span></div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(item.headline)}</h1><p>${esc(item.summary)}</p></div></a>`;
    }).catch(() => {});

  document.querySelector('.weekly-newsletter form')?.addEventListener('submit', event => {
    event.preventDefault();
    event.currentTarget.innerHTML = '<strong>Sign-up is not connected yet.</strong><p>The form is ready for the mailing service, but it has not stored your address.</p>';
  });
})();
