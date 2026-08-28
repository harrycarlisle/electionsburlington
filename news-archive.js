(() => {
  const grid = document.getElementById('newsGrid');
  const search = document.getElementById('newsFilter');
  const select = document.getElementById('newsTopic');
  const more = document.getElementById('showMore');
  if (!grid) return;

  const INITIAL_DESKTOP = 9;
  const INITIAL_MOBILE = 6;
  const TORONTO_TZ = 'America/Toronto';
  let expanded = false;
  let cards = [];

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeImage = value => {
    const raw = String(value || '').trim();
    if (!raw) return '/assets/editorial/home-share.webp';
    if (/^https?:\/\//.test(raw) || raw.startsWith('/')) return raw;
    return `/${raw}`;
  };
  const publicPath = value => {
    let raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//.test(raw)) {
      try {
        const parsed = new URL(raw);
        if (parsed.origin !== location.origin) return '';
        raw = parsed.pathname;
      } catch (_) { return ''; }
    }
    if (!raw.startsWith('/')) raw = `/${raw}`;
    if (/^\/articles\/auto\//.test(raw)) return raw;
    const storyMatch = raw.match(/^\/articles\/([^/]+)\.html$/i);
    if (storyMatch) return `/stories/${storyMatch[1]}/`;
    return raw;
  };
  const topicFor = item => {
    const topic = `${item?.topic || ''} ${item?.label || ''} ${(item?.subjects || []).join(' ')}`.toLowerCase();
    if (/public.?safety|police|crime|fire|emergency/.test(topic)) return 'public-safety';
    if (/traffic|road|transport|transit|e.?scooter|closure/.test(topic)) return 'roads';
    if (/school|student|education/.test(topic)) return 'schools';
    if (/food|event|restaurant|ribfest|festival|business|cafe/.test(topic)) return 'food';
    if (/sport|ultimate|hockey|lacrosse|ringette/.test(topic)) return 'sports';
    if (/history|explainer|skyway|heritage/.test(topic)) return 'history';
    if (/development|burlington|city|infrastructure|housing|quarry|factory|costco|stormwater/.test(topic)) return 'city';
    return 'city';
  };
  const topicTokens = item => {
    const tokens = new Set([topicFor(item)]);
    const kind = String(item?.kind || '').toLowerCase();
    if (['original','explainer','feature'].includes(kind)) tokens.add('originals');
    if (kind === 'explainer' || /history|explainer/.test(`${item?.topic || ''} ${item?.label || ''}`.toLowerCase())) tokens.add('history');
    const subjectText = (item?.subjects || []).join(' ').toLowerCase();
    if (/traffic|road|transit|transport/.test(subjectText)) tokens.add('roads');
    if (/school|education|student/.test(subjectText)) tokens.add('schools');
    if (/food|restaurant|event|festival|business/.test(subjectText)) tokens.add('food');
    if (/sport/.test(subjectText)) tokens.add('sports');
    return [...tokens].join(' ');
  };
  const timestamp = item => item?.publishedAt || item?.datePublished || item?.published || item?.activeFrom || item?.date || '';
  const stampValue = item => {
    const raw = timestamp(item);
    const parsed = Date.parse(raw || '');
    if (Number.isFinite(parsed)) return parsed;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? Date.parse(`${raw}T12:00:00-04:00`) : NaN;
    return Number.isFinite(day) ? day : 0;
  };
  const dateLabel = value => {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return 'Recent';
    const now = Date.now();
    const dayOf = date => new Date(date).toLocaleDateString('en-CA',{timeZone:TORONTO_TZ});
    if (dayOf(time) === dayOf(now)) {
      const hours = Math.max(0, Math.floor((now - time) / 3600000));
      return hours < 1 ? 'Just now' : `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    if (dayOf(time) === dayOf(now - 86400000)) return 'Yesterday';
    return new Intl.DateTimeFormat('en-CA',{timeZone:TORONTO_TZ,month:'short',day:'numeric'}).format(new Date(time));
  };
  const gatesPass = item => {
    const gates = item?.gates;
    if (!gates) return true;
    return ['evidence','burlington','imageRights','duplicate'].every(key => gates[key] === 'passed');
  };
  const isPublishedNow = item => {
    const start = Date.parse(item?.activeFrom || item?.published || item?.publishedAt || '');
    return !Number.isFinite(start) || start <= Date.now();
  };
  const isOwnedStory = item => {
    const raw = String(item?.url || item?.path || '');
    return /^(\/?stories\/|\/?articles\/)/.test(raw) || raw.startsWith(location.origin);
  };
  const mergedItem = (item, overrides) => ({...item,...(overrides?.[String(item?.id || '')] || {})});

  function renderStory(item) {
    const path = publicPath(item.url || item.path);
    if (!path) return null;
    const card = document.createElement('a');
    const isBreaking = String(item.status || '').toLowerCase() === 'breaking';
    card.className = `news-card${isBreaking ? ' news-card-breaking' : ''}`;
    card.href = path;
    if (item.id) card.dataset.storyId = item.id;
    card.dataset.topic = topicTokens(item);
    card.dataset.published = timestamp(item);
    const label = item.label || item.tag || (topicFor(item) === 'public-safety' ? 'Public safety' : 'Burlington');
    const image = normalizeImage(item.image);
    card.innerHTML = `<img src="${esc(image)}" alt="${esc(item.alt || item.headline)}" loading="lazy" decoding="async"><div class="news-card-copy"><small>${esc(label)} · ${esc(dateLabel(timestamp(item)))}</small><strong>${esc(item.headline)}</strong>${item.deck ? `<p>${esc(item.deck)}</p>` : ''}</div>`;
    card.querySelector('img')?.addEventListener('error', event => {
      const img = event.currentTarget;
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = '/assets/editorial/home-share.webp';
    });
    return card;
  }

  async function loadJson(url) {
    const response = await fetch(url, {cache:'no-store'});
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }

  async function hydrateArchive() {
    try {
      const [catalogResult, overridesResult, breakingResult, autoResult] = await Promise.allSettled([
        loadJson('/data/story-catalog.json'),
        loadJson('/data/story-overrides.json'),
        loadJson('/data/breaking-archive.json'),
        loadJson('/data/auto-published.json')
      ]);
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : {items:[]};
      const overrides = overridesResult.status === 'fulfilled' ? overridesResult.value : {};
      const breaking = breakingResult.status === 'fulfilled' ? breakingResult.value : {items:[]};
      const auto = autoResult.status === 'fulfilled' ? autoResult.value : {items:[]};
      const merged = new Map();

      (catalog.items || [])
        .filter(item => item?.headline && isOwnedStory(item) && gatesPass(item) && isPublishedNow(item))
        .map(item => mergedItem(item, overrides))
        .forEach(item => {
          const path = publicPath(item.url || item.path);
          if (path) merged.set(path, item);
        });

      (auto.items || []).filter(item => item?.headline && item?.path).forEach(item => {
        const path = publicPath(item.path);
        if (!path || merged.has(path)) return;
        merged.set(path, {
          ...item,
          id: `auto-${path}`,
          url: path,
          label: item.tag || 'Local update',
          publishedAt: item.date ? `${item.date}T12:00:00-04:00` : '',
          topic: item.tag || 'city',
          kind: 'brief'
        });
      });

      (breaking.items || []).filter(item => item?.headline && item?.url).forEach(item => {
        const path = publicPath(item.url);
        if (!path) return;
        merged.set(path, {...(merged.get(path) || {}),...item,url:path});
      });

      const rows = [...merged.values()].sort((a,b) => stampValue(b) - stampValue(a));
      if (!rows.length) return;
      const fragment = document.createDocumentFragment();
      rows.forEach(item => {
        const card = renderStory(item);
        if (card) fragment.appendChild(card);
      });
      if (fragment.childNodes.length) {
        grid.replaceChildren(fragment);
        expanded = false;
      }
    } catch (_) {
      // The server-rendered cards remain a complete, useful fallback.
    }
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
    cards.sort((a,b) => Date.parse(b.dataset.published || 0) - Date.parse(a.dataset.published || 0));
    cards.forEach(card => grid.appendChild(card));
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
      const baseLimit = isMobile() ? INITIAL_MOBILE : INITIAL_DESKTOP;
      const needsMore = matches.length > baseLimit;
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

  paint();
  hydrateArchive().finally(paint);
})();
