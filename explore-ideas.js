(function bootIdeas() {
const rank = globalThis.BurlingtonIdeaRank;
if (!rank) {
  setTimeout(bootIdeas, 20);
  return;
}
const { scoreIdea, afterDarkMode } = rank;
const rankPick = rank.pickNext;

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
let weather = { raining: false, clear: false, thunderstorm: false, snow: false, heat: false };
let currentId = '';
const prefs = readObject(STORAGE_PREFS);
let seen = readList(STORAGE_SEEN);
let sunsetHour = 20;

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
    minute: 'numeric',
    hour12: false
  }).formatToParts(new Date());
  const num = name => Number(parts.find(part => part.type === name)?.value || 0);
  const hour = num('hour');
  const minute = num('minute');
  const weekday = parts.find(part => part.type === 'weekday')?.value || '';
  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour,
    minute,
    weekday,
    weekdayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday),
    date: `${String(num('year')).padStart(4, '0')}-${String(num('month')).padStart(2, '0')}-${String(num('day')).padStart(2, '0')}`,
    iso: new Date().toISOString(),
    isDaylight: hour + minute / 60 < sunsetHour - 0.25,
    prefs
  };
}

function pickNext(avoidId = currentId) {
  const now = torontoNow();
  const chosen = rankPick(ideas, now, weather, seen, avoidId);
  if (!chosen) return null;
  currentId = chosen.id;
  seen = [...seen.filter(id => id !== chosen.id), chosen.id];
  if (seen.length > Math.max(ideas.length - 1, 1)) seen = seen.slice(-Math.max(ideas.length - 1, 1));
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
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=43.3255&longitude=-79.7990&current=weather_code,temperature_2m&daily=sunset&timezone=America/Toronto', { signal: controller.signal });
    if (!response.ok) return;
    const data = await response.json();
    const code = Number(data.current?.weather_code);
    const temp = Number(data.current?.temperature_2m);
    const sunset = String(data.daily?.sunset?.[0] || '');
    const match = sunset.match(/T(\d{2}):(\d{2})/);
    if (match) sunsetHour = Number(match[1]) + Number(match[2]) / 60;
    weather = {
      raining: Number.isFinite(code) && code >= 51 && code < 95,
      thunderstorm: Number.isFinite(code) && code >= 95,
      snow: Number.isFinite(code) && code >= 71 && code <= 77,
      heat: Number.isFinite(temp) && temp >= 31,
      clear: code === 0 || code === 1
    };
  } catch (_) {
    weather = { raining: false, clear: false, thunderstorm: false, snow: false, heat: false };
  } finally {
    clearTimeout(timer);
  }
}

async function load() {
  if (ideas.length) return ideas;
  const eventResponse = await fetch('/data/explore-events.json', { cache: 'no-store' });
  if (!eventResponse.ok) throw new Error('Explore ideas unavailable');
  const data = await eventResponse.json();
  ideas = Array.isArray(data.boredIdeas) ? data.boredIdeas : [];
  return ideas;
}

function ideaMarkup(idea) {
  if (!idea) return '';
  const pref = prefs[idea.id] || {};
  const image = idea.image
    ? `<div class="bored-visual"><img src="${esc(imageSrc(idea.image))}" alt="${esc(idea.imageAlt || '')}" loading="lazy">${idea.credit && !idea.illustration && !/^Burlington News/i.test(idea.credit) ? `<span class="image-credit">${esc(idea.credit)}</span>` : ''}</div>`
    : '';
  const maps = `<a class="bored-maps" href="${esc(mapsUrl(idea))}" target="_blank" rel="noopener">Open in Maps →</a>`;
  return `${image}<div class="bored-copy"><strong>${esc(idea.title)}</strong><p>${esc(idea.description || idea.copy || '')}</p><button class="primary-button idea-shuffle" type="button" data-idea-shuffle>Another idea ↻</button><div class="bored-actions"><button type="button" data-bored="like" class="${pref.like ? 'is-on' : ''}" aria-pressed="${pref.like ? 'true' : 'false'}">♡ Like</button><button type="button" data-bored="skip" class="${pref.skip ? 'is-on' : ''}" aria-pressed="${pref.skip ? 'true' : 'false'}">× Not for me</button>${maps}</div></div>`;
}

function mountExplore(root, extraButton) {
  if (!root) return;
  const paint = idea => {
    if (!idea) {
      root.innerHTML = '<div class="bored-copy"><strong>Nothing fits this moment.</strong><p>Try again after the weather settles, or pick an indoor idea from Explore.</p></div>';
      return;
    }
    root.innerHTML = ideaMarkup(idea);
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
    loadWeather().then(() => paint(current() || pickNext()));
    if (location.hash === '#bored') {
      document.getElementById('boredCard')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });
}

window.BurlingtonIdeas = { load, pickNext, current, mapsUrl, imageSrc, prefs, setPref, mountExplore, scoreIdea, afterDarkMode };
})();
