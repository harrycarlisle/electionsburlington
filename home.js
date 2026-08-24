(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const today = document.getElementById('today');
  const searchForm = document.getElementById('headerSearch');
  const searchInput = document.getElementById('siteSearch');
  const searchResults = document.getElementById('searchResults');
  const searchPopover = document.getElementById('searchPopover');
  const searchSuggestions = document.getElementById('searchSuggestions');
  const searchClear = document.getElementById('searchClear');
  const latestList = document.getElementById('latestList');
  const cleanDash = value => String(value || '').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

  const searchIndex = [
    {title:'Ontario nearly replaced the Skyway with three tunnels',url:'articles/skyway-bridge-story.html',section:'History',keywords:'skyway bridge canal qew tunnels'},
    {title:'Ribfest turns 30',url:'articles/ribfest-2026.html',section:'Events',keywords:'ribfest ribs labour day food festival'},
    {title:'The school dates Burlington families need',url:'articles/back-to-school-2026.html',section:'Schools',keywords:'school calendar hdsb September'},
    {title:'What Ontario students can actually be searched for',url:'articles/ontario-student-rights-school.html',section:'Schools',keywords:'teacher phone detention bag locker search student rights school'},
    {title:'730 Brant sat empty for more than a decade, then caught fire',url:'articles/730-brant-vacant-building.html',section:'Investigation',keywords:'abandoned vacant building fire Brant Street owner redevelopment'},
    {title:'Explore Burlington',url:'explore.html',section:'Explore',keywords:'events bored passport calendar places free'},
    {title:'Burlington 2026 Election Guide',url:'election-guide.html',section:'Elections',keywords:'vote mayor candidates ward ballot'},
    {title:'Burlington sports',url:'sports.html',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette'},
    {title:'Games about Burlington',url:'puzzles.html',section:'Games',keywords:'quiz puzzle trivia swipe'},
    {title:'Live Skyway traffic cameras',url:'skyway-traffic.html',section:'Traffic',keywords:'qew skyway traffic camera commute'}
  ];
  const suggested = ['this weekend','things to do','election'];
  const imageCredits = {
    'assets/editorial/burlington-wards-2026.svg': 'Burlington News diagram',
    'assets/home/ribs.webp': 'Thogru · CC BY-SA 3.0',
    'assets/home/school-bus.webp': 'QUOI Media · CC BY-SA 2.0',
    'assets/home/fishway.webp': 'Jeff Hitchcock · CC BY 2.0'
  };

  if (today) today.textContent = new Intl.DateTimeFormat('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());

  const rotatingPrompts = ['Search this weekend','Search the election','Search things to do','Search “I’m bored”','Search property taxes'];
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
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menu?.setAttribute('aria-expanded','false');
  }));

  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  function ranked(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return searchIndex.slice(0,6);
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
    searchClear.hidden = !query;
  }
  if (searchSuggestions) searchSuggestions.innerHTML = suggested.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');
  searchSuggestions?.addEventListener('click', event => {
    const button = event.target.closest('[data-search]');
    if (!button) return;
    searchInput.value = button.dataset.search;
    renderSearch(searchInput.value);
  });
  searchInput?.addEventListener('focus', () => renderSearch(searchInput.value));
  searchInput?.addEventListener('input', () => renderSearch(searchInput.value));
  searchClear?.addEventListener('click', () => { searchInput.value=''; renderSearch(''); searchInput.focus(); });
  searchForm?.addEventListener('submit', event => {
    event.preventDefault();
    const first = searchResults?.querySelector('a');
    if (first) location.href = first.href;
  });
  document.addEventListener('click', event => {
    if (searchForm && !searchForm.contains(event.target)) {
      searchPopover.hidden = true;
      searchInput.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    nav?.classList.remove('is-open');
    searchPopover.hidden = true;
  });

  if (searchInput && new URLSearchParams(location.search).get('search') === '1') {
    requestAnimationFrame(() => {
      searchInput.focus();
      renderSearch('');
      history.replaceState(null,'',location.pathname);
    });
  }

  fetch('data/home-surface.json',{cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (!latestList || !Array.isArray(data.latest) || !data.latest.length) return;
      latestList.innerHTML = data.latest.slice(0,3).map((item,index) => {
        const external = /^https?:\/\//.test(item.url || '');
        const credit = imageCredits[item.image] || '';
        const visual = item.image ? `<span class="newest-thumb"><img src="${esc(item.image)}" alt="${esc(item.alt || '')}" loading="lazy">${credit && !/^Burlington News/i.test(credit) ? `<i>${esc(credit)}</i>` : ''}</span>` : '<span class="puzzle-icon blue">BN</span>';
        return `<a href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${visual}<span>${item.labelEssential && item.label ? `<small>${esc(item.label)}</small>` : ''}<strong>${esc(item.headline)}</strong><time>${index ? `${index * 2} hours ago` : 'Today'}</time></span></a>`;
      }).join('');
    }).catch(() => {});

  document.querySelector('.weekly-newsletter form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    form.innerHTML = '<strong>Sign-up is not connected yet.</strong><p>The form is ready for the mailing service, but it has not stored your address.</p>';
  });
})();
