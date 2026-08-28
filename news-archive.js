(() => {
  const grid = document.getElementById('newsGrid');
  const search = document.getElementById('newsFilter');
  const select = document.getElementById('newsTopic');
  const more = document.getElementById('showMore');
  if (!grid) return;

  const INITIAL_DESKTOP = 9;
  const INITIAL_MOBILE = 6;
  let expanded = false;
  let cards = [];

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeImage = value => {
    const raw = String(value || '').trim();
    if (!raw) return '/assets/editorial/home-share.webp';
    if (/^https?:\/\//.test(raw) || raw.startsWith('/')) return raw;
    return `/${raw}`;
  };
  const topicFor = item => {
    const topic = String(item?.topic || item?.label || '').toLowerCase();
    if (/public.?safety|police|crime/.test(topic)) return 'public-safety';
    if (/traffic|road|transport/.test(topic)) return 'roads';
    if (/school/.test(topic)) return 'schools';
    if (/food|event|restaurant/.test(topic)) return 'food';
    if (/sport/.test(topic)) return 'sports';
    if (/history|explainer/.test(topic)) return 'history';
    if (/development|burlington|city|infrastructure/.test(topic)) return 'city';
    return 'city';
  };
  const dateLabel = value => {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return 'Recent';
    const now = Date.now();
    const sameDay = new Date(time).toLocaleDateString('en-CA',{timeZone:'America/Toronto'}) === new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
    if (sameDay) {
      const hours = Math.max(0, Math.floor((now - time) / 3600000));
      return hours < 1 ? 'Just now' : `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    const yesterday = new Date(now - 86400000).toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
    const day = new Date(time).toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
    if (day === yesterday) return 'Yesterday';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'}).format(new Date(time));
  };

  async function prependBreakingArchive() {
    try {
      const response = await fetch('/data/breaking-archive.json', {cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      const existing = new Set([...grid.querySelectorAll('a[href]')].map(a => new URL(a.href, location.origin).pathname));
      const rows = (data.items || [])
        .filter(item => item?.url && item?.headline)
        .sort((a,b) => Date.parse(b.publishedAt || b.datePublished || 0) - Date.parse(a.publishedAt || a.datePublished || 0));
      const fragment = document.createDocumentFragment();
      rows.forEach(item => {
        const path = new URL(item.url, location.origin).pathname;
        if (existing.has(path)) return;
        existing.add(path);
        const card = document.createElement('a');
        card.className = 'news-card news-card-breaking';
        card.href = path;
        card.dataset.topic = `${topicFor(item)} city`;
        card.dataset.published = item.publishedAt || item.datePublished || '';
        card.innerHTML = `<img src="${esc(normalizeImage(item.image))}" alt="${esc(item.alt || item.headline)}"><div class="news-card-copy"><small>${esc(item.label || 'Public safety')} · ${esc(dateLabel(item.publishedAt || item.datePublished))}</small><strong>${esc(item.headline)}</strong>${item.deck ? `<p>${esc(item.deck)}</p>` : ''}</div>`;
        fragment.appendChild(card);
      });
      if (fragment.childNodes.length) grid.prepend(fragment);
    } catch (_) {}
  }

  const params = new URLSearchParams(location.search);
  const requestedTopic = params.get('topic');
  if (select && requestedTopic && [...select.options].some(option => option.value === requestedTopic)) select.value = requestedTopic;

  const isMobile = () => matchMedia('(max-width:760px)').matches;
  const hay = card => `${card.dataset.topic || ''} ${card.textContent || ''}`.toLowerCase();

  function filteredCards() {
    const query = (search?.value || '').trim().toLowerCase();
    const topic = select?.value || 'all';
    return cards.filter(card => {
      const matchesTopic = topic === 'all' || (card.dataset.topic || '').split(/\s+/).includes(topic);
      const matchesQuery = !query || hay(card).includes(query);
      return matchesTopic && matchesQuery;
    });
  }

  function paint() {
    cards = [...grid.querySelectorAll('.news-card')];
    const matches = filteredCards();
    const limit = expanded ? Infinity : (isMobile() ? INITIAL_MOBILE : INITIAL_DESKTOP);
    const allowed = new Set(matches.slice(0, limit));
    cards.forEach(card => { card.hidden = !allowed.has(card); });

    let empty = grid.querySelector('.news-empty');
    if (!matches.length) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'news-empty';
        empty.textContent = 'No Burlington News stories match that search yet.';
        grid.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) empty.hidden = true;

    if (more) {
      const needsMore = matches.length > (isMobile() ? INITIAL_MOBILE : INITIAL_DESKTOP);
      more.hidden = !needsMore;
      more.textContent = expanded ? 'Show less' : 'Show more';
      more.setAttribute('aria-expanded', String(expanded));
    }
  }

  search?.addEventListener('input', () => { expanded = false; paint(); });
  select?.addEventListener('change', () => {
    expanded = false;
    const value = select.value;
    const url = new URL(location.href);
    if (value === 'all') url.searchParams.delete('topic'); else url.searchParams.set('topic', value);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    paint();
  });
  more?.addEventListener('click', () => { expanded = !expanded; paint(); });
  addEventListener('resize', paint, {passive:true});

  prependBreakingArchive().finally(paint);
})();