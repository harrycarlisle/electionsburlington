(() => {
  const menu = document.getElementById('menuButton');
  const nav = document.getElementById('primaryNav');
  const latestList = document.getElementById('latestList');
  const pickGrid = document.getElementById('pickGrid');
  const lead = document.querySelector('.top-story');
  const root = document.documentElement;
  const themeKey = 'burlington-news-theme';
  const cleanDash = value => String(value || '').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const publicUrl = value => {
    const raw = String(value || '');
    if (/^https?:\/\//.test(raw)) return raw;
    const story = raw.match(/^articles\/([^/]+)\.html$/);
    if (story) return `/stories/${story[1]}/`;
    if (raw === 'updates.html') return '/news/';
    if (raw === 'explore.html') return '/explore/';
    if (raw === 'election-guide.html' || raw.startsWith('election-guide.html')) return raw.replace('election-guide.html', '/elections/');
    if (raw === 'skyway-traffic.html') return '/traffic/';
    if (raw === 'sports.html') return '/sports/';
    if (raw === 'puzzles.html') return '/games/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  };
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
    if (/cafe|restaurant|food|ribfest/.test(haystack)) return 'Food';
    if (/development|brant|building|housing|millcroft|zoning|construction|data centre/.test(haystack)) return 'Development';
    if (/traffic|qew|skyway|road|closure/.test(haystack)) return 'Traffic';
    if (/sport|soccer|hockey|ringette|lacrosse|ultimate|golf/.test(haystack)) return 'Sports';
    if (/event|festival|weekend|concert/.test(haystack)) return 'Events';
    if (/fish|wildlife|nature|salamander|marsh|park|quarry|rabies/.test(haystack)) return 'Nature';
    if (/crime|police|safety/.test(haystack)) return 'Public safety';
    if (/canada|tariff|federal/.test(haystack)) return 'Canada';
    return 'Burlington';
  };
  const themeIcon = theme => theme === 'dark'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.7 8.7 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const setTheme = (theme, persist=true) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const target = next === 'dark' ? 'Light mode' : 'Dark mode';
      toggle.innerHTML = themeIcon(next);
      toggle.setAttribute('aria-label', `Switch to ${target.toLowerCase()}`);
    }
    if (persist) try { localStorage.setItem(themeKey, next); } catch (_) {}
  };
  setTheme(root.dataset.theme || 'light', false);

  window.BurlingtonSearch?.install(document.getElementById('headerSearch'), {
    homepage: true,
    rotate: true
  });
  window.BurlingtonIdeas?.mountHome(document.getElementById('homeIdea'));

  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-is-open', open);
  });
  nav?.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menu?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-is-open');
  }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    nav?.classList.remove('is-open');
    document.body.classList.remove('menu-is-open');
  });

  function tightenDeck(value){
    let text = cleanDash(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      const first = sentences[0].replace(/[.!?]$/, '');
      const second = sentences[1].replace(/^[A-Z]/, ch => ch.toLowerCase());
      text = `${first}, ${second}`;
    }
    const words = text.split(/\s+/);
    if (words.length > 30) text = `${words.slice(0, 30).join(' ').replace(/[.,;:]$/, '')}.`;
    return text;
  }

  function storyImage(item, fallback){
    const raw = item.image ? (item.image.startsWith('/') ? item.image : `/${item.image}`) : fallback;
    return /crime/i.test(`${item.id || ''} ${item.headline || ''}`) && /\.svg$|chart|comparison/i.test(raw)
      ? '/assets/editorial/halton-police-dusk.webp'
      : raw;
  }

  function renderLead(item){
    if (!lead || !item?.headline || !item?.url) return;
    const url = publicUrl(item.url);
    const external = /^https?:\/\//.test(url);
    const image = storyImage(item, '/assets/editorial/home-share.webp');
    const alt = /halton-police-dusk/.test(image) ? 'A Halton Regional Police vehicle at dusk behind police tape' : (item.alt || item.headline);
    const credit = /halton-police-dusk/.test(image) ? '' : (item.credit || 'Burlington News');
    const deck = tightenDeck(item.deck || '');
    lead.innerHTML = `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="top-image"><img src="${esc(image)}" alt="${esc(alt)}" fetchpriority="high">${credit ? `<span class="image-credit">${esc(credit)}</span>` : ''}</div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(item.headline)}</h1>${deck ? `<p>${esc(deck)}</p>` : ''}</div></a>`;
  }

  function renderNewest(items, heroId){
    if (!latestList || !items.length) return;
    const seen = new Set(heroId ? [heroId] : []);
    const rows = items.filter(item => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 4);
    latestList.innerHTML = rows.map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const image = storyImage(item, '');
      const category = categoryLabel(item);
      const thumb = image
        ? `<span class="newest-thumb"><img src="${esc(image)}" alt="" width="72" height="64" loading="lazy"></span>`
        : '';
      return `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''} data-category="${esc(category)}">${thumb}<span><small>${esc(category)}</small><strong>${esc(item.headline)}</strong><time>${esc(relativeDate(item.published || item.activeFrom))}</time></span></a>`;
    }).join('');
  }

  function renderPicks(items){
    if (!pickGrid || !items.length) return;
    pickGrid.innerHTML = items.slice(0, 3).map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const image = item.image ? (item.image.startsWith('/') ? item.image : `/${item.image}`) : '/assets/editorial/home-share.webp';
      return `<a class="pick-card" href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="pick-image"><img src="${esc(image)}" alt="${esc(item.alt || item.headline)}" loading="lazy"><span class="image-credit">${esc(item.credit || 'Burlington News')}</span></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(item.headline)}</h3>${item.deck ? `<p>${esc(item.deck)}</p>` : ''}</a>`;
    }).join('');
  }

  fetch('/data/home-surface.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (Array.isArray(data.feature) && data.feature.length) renderLead(data.feature[0]);
      const leadId = data.feature?.[0]?.id;
      if (Array.isArray(data.latest) && data.latest.length) renderNewest(data.latest, leadId);
      const picks = [...(data.feature || []).slice(1), ...(data.rail || [])].filter((item, index, list) => item.id !== leadId && list.findIndex(other => other.id === item.id) === index);
      renderPicks(picks);
    }).catch(() => {});
})();
