(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const today = document.getElementById('today');
  const weather = document.getElementById('weather');
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
    {title:'Explore Burlington',url:'explore.html',section:'Explore',keywords:'events bored passport calendar places free'},
    {title:'Burlington 2026 Election Guide',url:'election-guide.html',section:'Elections',keywords:'vote mayor candidates ward ballot'},
    {title:'Burlington sports',url:'sports.html',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette'},
    {title:'Games about Burlington',url:'puzzles.html',section:'Games',keywords:'quiz puzzle trivia swipe'},
    {title:'Live Skyway traffic cameras',url:'skyway-traffic.html',section:'Traffic',keywords:'qew skyway traffic camera commute'}
  ];
  const suggested = ['this weekend','Skyway','top food'];
  const imageCredits = {
    'assets/editorial/burlington-wards-2026.svg': 'Burlington News diagram',
    'assets/home/ribs.webp': 'Thogru · CC BY-SA 3.0',
    'assets/home/school-bus.webp': 'QUOI Media · CC BY-SA 2.0',
    'assets/home/fishway.webp': 'Jeff Hitchcock · CC BY 2.0'
  };

  if (today) today.textContent = new Intl.DateTimeFormat('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date());

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

  const weatherIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 17a4.2 4.2 0 0 1 .8-8.3A5.7 5.7 0 0 1 18 10.2 3.5 3.5 0 0 1 17.2 17h-11Z"/></svg>';
  if (weather) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),2600);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=temperature_2m&temperature_unit=celsius',{signal:controller.signal})
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        const temperature = Math.round(Number(data.current?.temperature_2m));
        if (!Number.isFinite(temperature)) return;
        weather.innerHTML = `${weatherIcon}<strong>${temperature}°</strong>`;
        weather.setAttribute('aria-label',`${temperature} degrees Celsius`);
        weather.hidden = false;
      }).catch(() => {}).finally(() => clearTimeout(timer));
  }

  fetch('data/home-surface.json',{cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (!latestList || !Array.isArray(data.latest) || !data.latest.length) return;
      latestList.innerHTML = data.latest.slice(0,3).map((item,index) => {
        const external = /^https?:\/\//.test(item.url || '');
        const credit = imageCredits[item.image] || 'Burlington News';
        const visual = item.image ? `<span class="newest-thumb"><img src="${esc(item.image)}" alt="${esc(item.alt || '')}" loading="lazy"><i>${esc(credit)}</i></span>` : '<span class="puzzle-icon blue">BN</span>';
        return `<a href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${visual}<span>${item.labelEssential && item.label ? `<small>${esc(item.label)}</small>` : ''}<strong>${esc(item.headline)}</strong><time>${index ? `${index * 2} hours ago` : 'Today'}</time></span></a>`;
      }).join('');
    }).catch(() => {});

  document.querySelector('.weekly-newsletter form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    form.innerHTML = '<strong>Sign-up is not connected yet.</strong><p>The form is ready for the mailing service, but it has not stored your address.</p>';
  });
})();
