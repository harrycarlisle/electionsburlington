(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const dropdown = document.querySelector('.nav-dropdown');
  const today = document.getElementById('today');
  const searchButton = document.getElementById('searchButton');
  const searchDialog = document.getElementById('searchDialog');
  const searchInput = document.getElementById('siteSearch');
  const searchResults = document.getElementById('searchResults');
  const latestList = document.getElementById('latestList');
  const searchIndex = [
    ['Ribfest turns 30: what to know before going','articles/ribfest-2026.html','Food · Events · Labour Day'],
    ['Why Burlington closes a road for salamanders','articles/salamander-road-closure.html','Wildlife · King Road'],
    ['What 26,503 fish revealed about Cootes Paradise','articles/fishway-26000-fish.html','Environment · RBG'],
    ['The back-to-school dates Burlington families need','articles/back-to-school-2026.html','Schools · September'],
    ['The ship crash that pushed Ontario to build the Skyway','articles/skyway-bridge-story.html','History · QEW'],
    ['Burlington 2026 Election Guide','election-guide.html','Elections · Candidates'],
    ['Compare mayoral candidates','head-to-head.html','Elections · Issues'],
    ['See your Burlington ballot','ballot.html','Elections · Wards'],
    ['Promises and public records','promises.html','Accountability · Elections'],
    ['Elections for beginners','elections-for-beginners.html','Explainer · Municipal government'],
    ['Explore Burlington','explore.html','Things to do · Free'],
    ['Puzzles about Burlington','puzzles.html','Games · Local knowledge']
  ];

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
      menu.textContent = 'Menu';
    };
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? 'Close' : 'Menu';
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

  const renderSearch = query => {
    if (!searchResults) return;
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = searchIndex.filter(item => terms.every(term => item.join(' ').toLowerCase().includes(term)));
    searchResults.innerHTML = matches.length
      ? matches.slice(0, 8).map(([title, url, section]) => `<a href="${url}"><span>${section}</span><strong>${title}</strong></a>`).join('')
      : '<p>No matches yet. Try a broader Burlington topic.</p>';
  };
  searchButton?.addEventListener('click', () => {
    searchDialog?.showModal();
    renderSearch('');
    requestAnimationFrame(() => searchInput?.focus());
  });
  searchInput?.addEventListener('input', event => renderSearch(event.target.value));

  const safeText = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  fetch('data/daily-brief.json', {cache: 'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      const blocked = /^(list of candidates|for candidates|candidate financials|candidate news and updates)$/i;
      const stories = (data.items || []).filter(item => item.url && item.headline && !blocked.test(item.headline)).slice(0, 3);
      if (!latestList || stories.length < 2) return;
      latestList.innerHTML = stories.map(item => `<a href="${safeText(item.url)}" target="_blank" rel="noopener"><span>${safeText(item.tag || 'Burlington')}</span><strong>${safeText(item.headline)}</strong><small>${safeText(item.summary || 'Open the source')}</small></a>`).join('');
    })
    .catch(() => {});
})();
