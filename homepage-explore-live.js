(() => {
  const grid = document.querySelector('.explore-home-grid');
  if (!grid) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const parse = value => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const eventEnd = event => Number.isFinite(parse(event.end)) ? parse(event.end) : parse(event.start) + (3 * 60 * 60 * 1000);
  const imageSrc = value => {
    const raw = String(value || '');
    if (!raw) return '/assets/editorial/explore-collage.webp';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    return `/${raw}`;
  };
  const city = event => String(event.city || event.scope || 'Burlington');
  const isBurlington = event => /burlington/i.test(`${event.scope || ''} ${event.city || ''}`);

  function labelFor(event) {
    const now = new Date();
    const start = new Date(event.start);
    const end = new Date(event.end || event.start);
    const sameDay = (a, b) => a.toLocaleDateString('en-CA', {timeZone:'America/Toronto'}) === b.toLocaleDateString('en-CA', {timeZone:'America/Toronto'});
    if (start <= now && end >= now) return isBurlington(event) ? 'Happening now' : `Nearby now · ${city(event)}`;
    if (sameDay(start, now)) return isBurlington(event) ? 'Tonight' : `Nearby tonight · ${city(event)}`;
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (sameDay(start, tomorrow)) return isBurlington(event) ? 'Tomorrow' : `Nearby tomorrow · ${city(event)}`;
    const days = Math.ceil((start - now) / 86400000);
    if (days <= 3) return isBurlington(event) ? 'This weekend' : `Nearby this weekend · ${city(event)}`;
    return isBurlington(event) ? 'Coming up' : `Nearby · ${city(event)}`;
  }

  function score(event) {
    const now = Date.now();
    const start = parse(event.start);
    const end = eventEnd(event);
    const days = Math.max(0, (start - now) / 86400000);
    let value = Number(event.weight || 0);
    if (isBurlington(event)) value += 14;
    else if (/oakville|hamilton|stoney creek/i.test(`${event.scope || ''} ${event.city || ''}`)) value += 8;
    if (start <= now && end >= now) value += 24;
    else if (days <= 1) value += 18;
    else if (days <= 3) value += 13;
    else if (days <= 7) value += 8;
    else if (days <= 21) value += 3;
    return value;
  }

  function choose(events) {
    const now = Date.now();
    const valid = events.filter(event => Number.isFinite(parse(event.start)) && eventEnd(event) >= now - (15 * 60 * 1000));
    const burlington = valid.filter(isBurlington).sort((a,b) => score(b) - score(a) || parse(a.start) - parse(b.start));
    const nearby = valid.filter(event => !isBurlington(event)).sort((a,b) => score(b) - score(a) || parse(a.start) - parse(b.start));
    const picks = [];
    if (burlington[0]) picks.push(burlington[0]);
    const regionalNow = nearby.find(event => parse(event.start) <= now + (3 * 86400000));
    if (regionalNow && !picks.some(item => item.id === regionalNow.id)) picks.push(regionalNow);
    const rest = [...valid].sort((a,b) => score(b) - score(a) || parse(a.start) - parse(b.start));
    for (const event of rest) {
      if (picks.length >= 2) break;
      if (picks.some(item => item.id === event.id)) continue;
      if (picks.some(item => imageSrc(item.image) === imageSrc(event.image))) continue;
      picks.push(event);
    }
    return picks.slice(0,2);
  }

  function render(events) {
    const picks = choose(events);
    if (!picks.length) return;
    grid.innerHTML = picks.map(event => {
      const href = `/explore/?event=${encodeURIComponent(event.id)}`;
      return `<a class="explore-home-card" href="${href}"><img src="${esc(imageSrc(event.image))}" alt="${esc(event.imageAlt || event.title)}" loading="lazy" decoding="async"><span><small>${esc(labelFor(event))}</small><strong>${esc(event.title)}</strong><em>${esc(event.summary || event.details || event.location)}</em></span></a>`;
    }).join('');
  }

  Promise.all([
    fetch('/data/explore-events.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {events:[]}).catch(() => ({events:[]})),
    fetch('/data/explore-events-nearby.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {events:[]}).catch(() => ({events:[]}))
  ]).then(([primary, regional]) => render([...(primary.events || []), ...(regional.events || [])]));
})();
