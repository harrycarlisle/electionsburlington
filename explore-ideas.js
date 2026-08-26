(() => {
  const STORAGE_PREFS = 'burlington-news-bored-prefs';
  const STORAGE_SEEN = 'burlington-news-bored-seen';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const readObject = key => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  };
  const writeObject = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  };
  const readList = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  };

  let ideas = [];
  let weather = { raining: false, clear: false };
  let currentId = '';
  const prefs = readObject(STORAGE_PREFS);
  let seen = readList(STORAGE_SEEN);

  function imageSrc(path) {
    const raw = String(path || '');
    if (!raw) return '';
    if (/^https?:\/\//.test(raw)) return raw;
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  function mapsUrl(idea) {
    const query = idea?.mapsQuery || [idea?.placeName, 'Burlington, Ontario'].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Burlington, Ontario')}`;
  }

  function torontoNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      hour12: false
    }).formatToParts(new Date());
    const num = name => Number(parts.find(part => part.type === name)?.value || 0);
    return {
      year: num('year'),
      month: num('month'),
      day: num('day'),
      hour: num('hour'),
      weekday: parts.find(part => part.type === 'weekday')?.value || '',
      date: `${String(num('year')).padStart(4,'0')}-${String(num('month')).padStart(2,'0')}-${String(num('day')).padStart(2,'0')}`
    };
  }

  function isActive(idea, now) {
    if (idea.activeFrom && idea.activeFrom > now.date) return false;
    if (idea.activeUntil && idea.activeUntil < now.date) return false;
    return true;
  }

  function scoreIdea(idea, now) {
    const pref = prefs[idea.id] || {};
    if (pref.skip) return 0;
    let score = 10;
    if (pref.like) score += 8;
    if (pref.planned) score += 3;
    const tags = `${idea.category || ''} ${idea.indoorOutdoor || ''} ${idea.cost || ''} ${(idea.tags || []).join(' ')}`.toLowerCase();
    const evening = now.hour >= 17 || now.hour < 5;
    const weekend = now.weekday === 'Sat' || now.weekday === 'Sun';
    const summer = now.month >= 6 && now.month <= 8;
    const winter = now.month === 12 || now.month <= 2;
    if (weather.raining && /indoor/.test(tags)) score += 8;
    if (weather.raining && /outdoor/.test(tags) && !/indoor/.test(tags)) score -= 6;
    if (weather.clear && /waterfront|sunset|park|trail/.test(tags)) score += 4;
    if (evening && /waterfront|sunset|night|date/.test(tags)) score += 6;
    if (!evening && /night|stargaz/.test(tags)) score -= 3;
    if (weekend && /event|market|family|trail/.test(tags)) score += 5;
    if (!weekend && /quick|coffee|food|downtown/.test(tags)) score += 2;
    if (summer && /waterfront|outdoor|ice cream|market/.test(tags)) score += 4;
    if (winter && /indoor|museum|cafe|coffee/.test(tags)) score += 4;
    if (idea.cost === 'free') score += 1;
    return Math.max(score, 1);
  }

  function eligible(now = torontoNow()) {
    return ideas.filter(idea => isActive(idea, now));
  }

  function pickNext(avoidId = currentId) {
    const now = torontoNow();
    const pool = eligible(now);
    if (!pool.length) return null;
    const open = pool.filter(idea => !(prefs[idea.id] || {}).skip);
    const usable = open.length ? open : pool;
    const fresh = usable.filter(idea => !seen.includes(idea.id) && idea.id !== avoidId);
    const source = fresh.length ? fresh : usable.filter(idea => idea.id !== avoidId);
    const pickFrom = source.length ? source : usable;
    const weighted = pickFrom.map(idea => ({ idea, score: scoreIdea(idea, now) }));
    const total = weighted.reduce((sum, item) => sum + item.score, 0);
    let ticket = Math.random() * total;
    let chosen = pickFrom[0];
    for (const item of weighted) {
      ticket -= item.score;
      if (ticket <= 0) {
        chosen = item.idea;
        break;
      }
    }
    currentId = chosen.id;
    seen = [...seen.filter(id => id !== chosen.id), chosen.id];
    if (seen.length > Math.max(usable.length - 1, 1)) seen = seen.slice(-Math.max(usable.length - 1, 1));
    writeObject(STORAGE_SEEN, seen);
    return chosen;
  }

  function current() {
    return ideas.find(idea => idea.id === currentId) || null;
  }

  function setPref(id, patch) {
    prefs[id] = { ...(prefs[id] || {}), ...patch };
    writeObject(STORAGE_PREFS, prefs);
    return prefs[id];
  }

  async function loadWeather() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=weather_code&timezone=America/Toronto', { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      const code = Number(data.current?.weather_code);
      weather = {
        raining: Number.isFinite(code) && code >= 51,
        clear: code === 0 || code === 1
      };
    } catch (_) {
      weather = { raining: false, clear: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    if (ideas.length) return ideas;
    const [eventResponse] = await Promise.all([
      fetch('/data/explore-events.json', { cache: 'no-store' }),
      loadWeather()
    ]);
    if (!eventResponse.ok) throw new Error('Explore ideas unavailable');
    const data = await eventResponse.json();
    ideas = Array.isArray(data.boredIdeas) ? data.boredIdeas : [];
    return ideas;
  }

  function ideaMarkup(idea, variant = 'explore') {
    if (!idea) return '';
    const pref = prefs[idea.id] || {};
    const image = idea.image
      ? `<div class="bored-visual"><img src="${esc(imageSrc(idea.image))}" alt="${esc(idea.imageAlt || '')}" loading="lazy">${idea.credit && !idea.illustration && !/Burlington News/i.test(idea.credit) && !/^(Graphic|Map|File photo|Courtesy photo)\b/i.test(idea.credit) ? `<span class="image-credit">${esc(idea.credit)}</span>` : ''}</div>`
      : '';
    const maps = `<a class="bored-maps" href="${esc(mapsUrl(idea))}" target="_blank" rel="noopener">Open in Maps →</a>`;
    if (variant === 'home') {
      return `<p class="home-idea-kicker">Need an idea?</p><p class="home-idea-title">${esc(idea.title)}</p><div class="home-idea-actions"><button type="button" data-idea-shuffle>Another idea ↻</button></div>`;
    }
    return `${image}<div class="bored-copy"><strong>${esc(idea.title)}</strong><p>${esc(idea.description || idea.copy || '')}</p><button class="primary-button idea-shuffle" type="button" data-idea-shuffle>Another idea ↻</button><div class="bored-actions"><button type="button" data-bored="like" class="${pref.like ? 'is-on' : ''}" aria-pressed="${pref.like ? 'true' : 'false'}">♡ Like</button><button type="button" data-bored="skip" class="${pref.skip ? 'is-on' : ''}" aria-pressed="${pref.skip ? 'true' : 'false'}">× Not for me</button>${maps}</div></div>`;
  }

  function mountHome(root) {
    if (!root) return;
    const paint = idea => {
      if (!idea) return;
      root.hidden = false;
      root.innerHTML = ideaMarkup(idea, 'home');
    };
    load().then(() => paint(pickNext())).catch(() => { root.hidden = false; });
    root.addEventListener('click', event => {
      if (!event.target.closest('[data-idea-shuffle]')) return;
      paint(pickNext(currentId));
    });
  }

  function mountExplore(root, extraButton) {
    if (!root) return;
    const paint = idea => {
      if (!idea) return;
      root.innerHTML = ideaMarkup(idea, 'explore');
    };
    const shuffle = () => paint(pickNext(currentId));
    extraButton?.addEventListener('click', shuffle);
    root.addEventListener('click', event => {
      const shuffleBtn = event.target.closest('[data-idea-shuffle]');
      if (shuffleBtn) {
        shuffle();
        return;
      }
      const button = event.target.closest('[data-bored]');
      const idea = current();
      if (!button || !idea) return;
      const pref = prefs[idea.id] || {};
      if (button.dataset.bored === 'like') setPref(idea.id, { like: !pref.like });
      if (button.dataset.bored === 'skip') {
        const skip = !pref.skip;
        setPref(idea.id, { skip });
        if (skip) {
          shuffle();
          return;
        }
      }
      paint(current());
    });
    return load().then(() => {
      paint(pickNext());
      if (location.hash === '#bored') {
        document.getElementById('boredCard')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  window.BurlingtonIdeas = { load, pickNext, current, mapsUrl, imageSrc, prefs, setPref, mountHome, mountExplore, eligible };
})();
