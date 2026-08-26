(() => {
  const STORAGE_PREFS = 'burlington-news-bored-prefs';
  const STORAGE_SEEN = 'burlington-news-bored-seen';
  const ALERTS_URL = 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=-79.95,43.25,-79.65,43.48&limit=25';
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
  let events = [];
  let weather = { raining: false, storm: false, snow: false, heat: false, clear: false, code: null, temp: null };
  let sun = { sunrise: null, sunset: null };
  let alerts = { thunderstorm: false, severe: false };
  let testContext = null;
  let currentId = '';
  const prefs = readObject(STORAGE_PREFS);
  if (!prefs.__skip) prefs.__skip = {};
  if (!prefs.__like) prefs.__like = {};
  let seen = readList(STORAGE_SEEN);

  function imageSrc(path) {
    const raw = String(path || '');
    if (!raw) return '';
    if (/^https?:\/\//.test(raw)) return raw;
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  function mapsUrl(idea) {
    const query = idea?.mapsQuery || [idea?.placeName, idea?.location, 'Burlington, Ontario'].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Burlington, Ontario')}`;
  }

  function torontoParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(date);
    const num = name => Number(parts.find(part => part.type === name)?.value || 0);
    return {
      year: num('year'),
      month: num('month'),
      day: num('day'),
      hour: num('hour'),
      minute: num('minute'),
      weekday: parts.find(part => part.type === 'weekday')?.value || '',
      date: `${String(num('year')).padStart(4,'0')}-${String(num('month')).padStart(2,'0')}-${String(num('day')).padStart(2,'0')}`,
      ms: date.getTime()
    };
  }

  function parseSun(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }

  function buildContext() {
    if (testContext) return testContext;
    const now = torontoParts();
    const sunrise = parseSun(sun.sunrise);
    const sunset = parseSun(sun.sunset);
    const dark = sunrise && sunset ? (now.ms < sunrise || now.ms >= sunset) : (now.hour >= 20 || now.hour < 6);
    const lateNight = now.hour > 21 || (now.hour === 21 && now.minute >= 30) || now.hour < 5;
    const season = now.month === 12 || now.month <= 2 ? 'winter' : now.month >= 6 && now.month <= 8 ? 'summer' : now.month >= 3 && now.month <= 5 ? 'spring' : 'fall';
    return {
      ...now,
      sunrise,
      sunset,
      dark,
      lateNight,
      season,
      weather: { ...weather },
      alerts: { ...alerts },
      weekend: now.weekday === 'Sat' || now.weekday === 'Sun'
    };
  }

  function setContext(ctx) {
    testContext = ctx || null;
  }

  function normalize(idea) {
    const tags = new Set([...(idea.tags || []), idea.category, idea.indoorOutdoor].filter(Boolean).map(value => String(value).toLowerCase()));
    const outdoor = idea.indoorOutdoor === 'outdoor';
    const isolated = idea.isolated === true || /trail|conservation|escarpment|boardwalk|shoreline|lookout/.test([...tags].join(' ')) && idea.isolated !== false;
    const nightAppropriate = idea.nightAppropriate === true || idea.nightAppropriate === 'dusk';
    return {
      ...idea,
      tags: [...tags],
      indoorOutdoor: idea.indoorOutdoor || (tags.has('indoor') ? 'indoor' : 'outdoor'),
      nightAppropriate,
      nightWindow: idea.nightAppropriate === 'dusk' ? 'dusk' : (nightAppropriate ? 'night' : 'day'),
      requiresDaylight: idea.requiresDaylight != null ? idea.requiresDaylight : outdoor && !nightAppropriate,
      staffed: idea.staffed === true,
      publicEvent: idea.publicEvent === true,
      isolated: isolated && idea.isolated !== false,
      wellLit: idea.wellLit === true,
      weatherSensitivity: idea.weatherSensitivity || (outdoor ? 'high' : 'low'),
      season: idea.season || 'all',
      costLevel: idea.costLevel || idea.cost || 'free',
      familyFriendly: idea.familyFriendly !== false,
      dateSpecific: Boolean(idea.activeFrom || idea.activeUntil || idea.dateSpecific),
      quality: Number(idea.quality || 3)
    };
  }

  function isActive(idea, ctx) {
    if (idea.activeFrom && idea.activeFrom > ctx.date) return false;
    if (idea.activeUntil && idea.activeUntil < ctx.date) return false;
    if (idea.season && idea.season !== 'all') {
      if (idea.season === 'summer' && ctx.season === 'winter') return false;
      if (idea.season === 'winter' && ctx.season === 'summer') return false;
      if (idea.season === 'warm' && ctx.season === 'winter') return false;
    }
    if (idea.eventStart && idea.eventEnd) {
      const start = new Date(idea.eventStart).getTime();
      const end = new Date(idea.eventEnd).getTime();
      if (Number.isFinite(start) && ctx.ms < start - 2 * 60 * 60 * 1000) return false;
      if (Number.isFinite(end) && ctx.ms > end) return false;
    }
    return true;
  }

  function minutesOfDay(hour, minute) {
    return hour * 60 + minute;
  }

  function parseClock(value) {
    const [hour, minute] = String(value || '00:00').split(':').map(Number);
    return minutesOfDay(hour || 0, minute || 0);
  }

  function weekdayIndex(ctx) {
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[ctx.weekday];
  }

  function openState(idea, ctx) {
    if (idea.eventStart && idea.eventEnd) {
      const start = new Date(idea.eventStart).getTime();
      const end = new Date(idea.eventEnd).getTime();
      if (Number.isFinite(start) && Number.isFinite(end)) return ctx.ms >= start && ctx.ms <= end;
    }
    const hours = idea.openHours;
    if (!hours || !hours.length) return null;
    const day = weekdayIndex(ctx);
    const row = hours.find(item => (item.days || []).includes(day));
    if (!row) return false;
    const now = minutesOfDay(ctx.hour, ctx.minute);
    return now >= parseClock(row.open) && now < parseClock(row.close);
  }

  function liveEvent(idea, ctx) {
    const matchId = idea.eventId;
    if (!matchId) return null;
    return events.find(event => event.id === matchId && new Date(event.start).getTime() <= ctx.ms && new Date(event.end).getTime() >= ctx.ms) || null;
  }

  function eventHappening(event, ctx) {
    return new Date(event.start).getTime() <= ctx.ms && new Date(event.end).getTime() >= ctx.ms;
  }

  function afterDarkAllowed(idea, ctx) {
    const live = liveEvent(idea, ctx);
    if (live || idea.publicEvent && openState(idea, ctx) === true) return true;
    if (idea.nightWindow === 'dusk' && !ctx.lateNight) return !idea.isolated;
    if (idea.nightAppropriate && (idea.wellLit || !idea.isolated)) return true;
    if (idea.indoorOutdoor === 'indoor' && idea.staffed) return true;
    if (idea.wellLit && idea.indoorOutdoor !== 'outdoor' || idea.wellLit && !idea.isolated) return !idea.requiresDaylight;
    return false;
  }

  function weatherOk(idea, ctx) {
    const outdoor = idea.indoorOutdoor === 'outdoor';
    if (ctx.alerts.thunderstorm && outdoor && !idea.publicEvent) return false;
    if (ctx.weather.storm && outdoor && !idea.publicEvent) return false;
    if ((ctx.weather.raining || ctx.weather.snow) && outdoor && idea.weatherSensitivity === 'high' && !idea.publicEvent) return false;
    return true;
  }

  function eligibleIdea(idea, ctx) {
    const item = normalize(idea);
    if (!isActive(item, ctx)) return false;
    const open = openState(item, ctx);
    if (open === false) return false;
    if (!weatherOk(item, ctx)) return false;
    if (ctx.dark && !afterDarkAllowed(item, ctx)) return false;
    if (ctx.lateNight) {
      const live = liveEvent(item, ctx);
      if (item.nightWindow === 'dusk' && !item.publicEvent && !live) return false;
      const nightOk = item.indoorOutdoor === 'indoor' || item.staffed || item.publicEvent || item.nightAppropriate || live;
      if (!nightOk) return false;
      if (item.isolated && !live && !item.publicEvent) return false;
      if (open === false) return false;
      if (item.indoorOutdoor === 'outdoor' && !item.nightAppropriate && !item.publicEvent && !live) return false;
    }
    return true;
  }

  function scoreIdea(idea, ctx) {
    const item = normalize(idea);
    const pref = prefs[item.id] || {};
    if (pref.skip) return 0;
    let score = 12 + item.quality;
    if (pref.like) score += 8;
    const tags = item.tags;
    tags.forEach(tag => {
      score -= (prefs.__skip[tag] || 0) * 6;
      score += (prefs.__like[tag] || 0) * 3;
    });
    const open = openState(item, ctx);
    if (open === true) score += 10;
    if (open === null && ctx.lateNight) score -= 4;
    if (item.indoorOutdoor === 'indoor' && (ctx.weather.raining || ctx.weather.storm || ctx.weather.snow || ctx.weather.heat || ctx.alerts.thunderstorm)) score += 8;
    if (item.indoorOutdoor === 'outdoor' && ctx.weather.clear && !ctx.dark) score += 5;
    if (item.indoorOutdoor === 'outdoor' && ctx.weather.heat && item.weatherSensitivity === 'high') score -= 5;
    if (ctx.dark && item.isolated) score -= 20;
    if (ctx.dark && item.nightAppropriate) score += 8;
    if (!ctx.dark && item.nightWindow === 'night' && !item.dateSpecific) score -= 8;
    if (ctx.weekend && /event|market|family|trail/.test(tags.join(' '))) score += 3;
    if (!ctx.weekend && /quick|coffee|food|downtown/.test(tags.join(' '))) score += 2;
    if (ctx.season === 'summer' && /waterfront|outdoor|ice cream|market/.test(tags.join(' '))) score += 3;
    if (ctx.season === 'winter' && /indoor|museum|cafe|coffee/.test(tags.join(' '))) score += 4;
    if (item.costLevel === 'free') score += 1;
    const happening = liveEvent(item, ctx);
    if (happening) score += 14;
    else if (item.eventId && events.some(event => event.id === item.eventId)) score -= 4;
    return Math.max(score, 0);
  }

  function eventIdea(event) {
    const outdoor = /festival|concert|market|night|eclipse|park|waterfront/i.test(`${event.category} ${event.title} ${event.location}`);
    const night = /night|eclipse|festival|concert/i.test(`${event.category} ${event.title}`);
    return normalize({
      id: `event-${event.id}`,
      title: event.title,
      description: event.summary || event.details || '',
      placeName: event.location,
      mapsQuery: /burlington|hamilton|oakville/i.test(event.location || '') ? event.location : `${event.location}, Burlington, Ontario`,
      category: (event.category || 'event').toLowerCase(),
      indoorOutdoor: outdoor ? 'outdoor' : 'indoor',
      nightAppropriate: night,
      staffed: true,
      publicEvent: true,
      isolated: false,
      wellLit: true,
      weatherSensitivity: outdoor ? 'medium' : 'low',
      eventStart: event.start,
      eventEnd: event.end,
      eventId: event.id,
      image: event.image,
      imageAlt: event.imageAlt,
      credit: event.credit,
      illustration: event.illustration,
      quality: 4
    });
  }

  function pool(ctx = buildContext()) {
    const fromCatalog = ideas.map(normalize).filter(idea => eligibleIdea(idea, ctx));
    const live = events.filter(event => eventHappening(event, ctx)).map(eventIdea).filter(idea => eligibleIdea(idea, ctx));
    const combined = [...fromCatalog];
    live.forEach(item => {
      if (!combined.some(idea => idea.eventId === item.eventId || idea.id === item.id)) combined.push(item);
    });
    return combined;
  }

  function eligible(ctx = buildContext()) {
    return pool(ctx);
  }

  function pickFromTop(list, ctx, avoidId) {
    const ranked = list
      .map(idea => ({ idea, score: scoreIdea(idea, ctx) }))
      .filter(item => item.score > 0 && item.idea.id !== avoidId)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return list.find(idea => idea.id !== avoidId) || list[0] || null;
    const best = ranked[0].score;
    const top = ranked.filter(item => item.score >= best - 8).slice(0, 6);
    return top[Math.floor(Math.random() * top.length)].idea;
  }

  function pickNext(avoidId = currentId) {
    const ctx = buildContext();
    const open = pool(ctx).filter(idea => !(prefs[idea.id] || {}).skip);
    if (!open.length) return null;
    const fresh = open.filter(idea => !seen.includes(idea.id) && idea.id !== avoidId);
    const source = fresh.length ? fresh : open.filter(idea => idea.id !== avoidId);
    const chosen = pickFromTop(source.length ? source : open, ctx, avoidId);
    if (!chosen) return null;
    currentId = chosen.id;
    seen = [...seen.filter(id => id !== chosen.id), chosen.id];
    if (seen.length > Math.max(open.length - 1, 1)) seen = seen.slice(-Math.max(open.length - 1, 1));
    writeObject(STORAGE_SEEN, seen);
    return chosen;
  }

  function current() {
    return ideas.find(idea => idea.id === currentId) || pool().find(idea => idea.id === currentId) || null;
  }

  function rememberTags(bucket, idea, delta) {
    const item = normalize(idea);
    item.tags.forEach(tag => {
      prefs[bucket][tag] = Math.max(0, (prefs[bucket][tag] || 0) + delta);
    });
  }

  function setPref(id, patch) {
    const idea = ideas.find(item => item.id === id) || { id, tags: [] };
    const prev = prefs[id] || {};
    if (patch.skip && !prev.skip) rememberTags('__skip', idea, 1);
    if (patch.skip === false && prev.skip) rememberTags('__skip', idea, -1);
    if (patch.like && !prev.like) rememberTags('__like', idea, 1);
    if (patch.like === false && prev.like) rememberTags('__like', idea, -1);
    prefs[id] = { ...prev, ...patch };
    writeObject(STORAGE_PREFS, prefs);
    return prefs[id];
  }

  async function loadWeather() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=America/Toronto', { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      const code = Number(data.current?.weather_code);
      const temp = Number(data.current?.temperature_2m);
      weather = {
        code,
        temp,
        raining: Number.isFinite(code) && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)),
        storm: Number.isFinite(code) && code >= 95,
        snow: Number.isFinite(code) && ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)),
        heat: Number.isFinite(temp) && temp >= 32,
        clear: code === 0 || code === 1
      };
      sun = {
        sunrise: data.daily?.sunrise?.[0] || null,
        sunset: data.daily?.sunset?.[0] || null
      };
    } catch (_) {
      weather = { raining: false, storm: false, snow: false, heat: false, clear: false, code: null, temp: null };
    } finally {
      clearTimeout(timer);
    }
    try {
      const alertResponse = await fetch(ALERTS_URL);
      if (!alertResponse.ok) return;
      const data = await alertResponse.json();
      const titles = (data.features || []).map(item => `${item.properties?.alert_type || ''} ${item.properties?.name || ''}`).join(' ').toLowerCase();
      alerts = {
        thunderstorm: /thunder|severe thunderstorm/.test(titles),
        severe: /warning|tornado|storm/.test(titles)
      };
    } catch (_) {}
  }

  async function load() {
    if (ideas.length) return ideas;
    const [eventResponse] = await Promise.all([
      fetch('/data/explore-events.json', { cache: 'no-store' }),
      testContext ? Promise.resolve() : loadWeather()
    ]);
    if (!eventResponse.ok) throw new Error('Explore ideas unavailable');
    const data = await eventResponse.json();
    ideas = Array.isArray(data.boredIdeas) ? data.boredIdeas : [];
    if (!events.length) events = Array.isArray(data.events) ? data.events : [];
    return ideas;
  }

  function setEvents(list) {
    events = Array.isArray(list) ? list : [];
  }

  function setIdeas(list) {
    ideas = Array.isArray(list) ? list : [];
  }

  function ideaMarkup(idea, variant = 'explore') {
    if (!idea) return '';
    const pref = prefs[idea.id] || {};
    const image = idea.image
      ? `<div class="bored-visual"><img src="${esc(imageSrc(idea.image))}" alt="${esc(idea.imageAlt || '')}" loading="lazy">${idea.credit && !idea.illustration && !/^Burlington News/i.test(idea.credit) ? `<span class="image-credit">${esc(idea.credit)}</span>` : ''}</div>`
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
      if (!idea) {
        root.innerHTML = '<div class="bored-copy"><strong>Nothing that fits this moment</strong><p>Try again later, or browse this week’s events.</p></div>';
        return;
      }
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

  window.BurlingtonIdeas = {
    load,
    pickNext,
    current,
    mapsUrl,
    imageSrc,
    prefs,
    setPref,
    mountHome,
    mountExplore,
    eligible,
    scoreIdea,
    setContext,
    setEvents,
    setIdeas,
    buildContext,
    openState,
    normalize
  };
})();
