(() => {
  const grid = document.querySelector('.explore-band .pick-grid');
  if (!grid) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const parse = value => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const eventEnd = event => Number.isFinite(parse(event.end)) ? parse(event.end) : parse(event.start) + (3 * 60 * 60 * 1000);
  const torontoMonth = () => Number(new Intl.DateTimeFormat('en-CA',{month:'numeric',timeZone:'America/Toronto'}).format(new Date()));

  const curatedImage = event => {
    const key = `${event?.id || ''} ${event?.title || ''}`.toLowerCase();
    if (/elizabeth-gardens-art-walk|art walk/.test(key)) return '/assets/art-walk.png';
    if (/farmers.?market/.test(key)) return torontoMonth() >= 9 ? '/assets/farmers-market-fall.png' : '/assets/farmers-market-summer.png';
    if (/bbcc|bums regatta|f18 championship|sail/.test(key)) return '/assets/Four%20Sailboats%20on%20a%20Choppy%20Lake%20-bbc-bums.png';
    if (/asian night|asian market|night market/.test(key)) return '/assets/asian-food-night.png';
    return '';
  };

  const imageSrc = event => {
    const raw = curatedImage(event) || String(event?.image || '');
    if (!raw) return '/assets/editorial/explore-collage.webp';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    return `/${raw}`;
  };
  const imageAlt = event => {
    const key = `${event?.id || ''} ${event?.title || ''}`.toLowerCase();
    if (/art walk/.test(key)) return 'Visitors walking through an outdoor community art event.';
    if (/farmers.?market/.test(key)) return 'Fresh produce at an outdoor farmers market.';
    if (/bbcc|bums regatta|f18 championship|sail/.test(key)) return 'Sailboats racing on Lake Ontario.';
    if (/asian night|night market/.test(key)) return 'Food stalls and visitors at an evening Asian food market.';
    return event?.imageAlt || event?.title || 'Explore Burlington event';
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
      if (picks.some(item => imageSrc(item) === imageSrc(event))) continue;
      picks.push(event);
    }
    return picks.slice(0,2);
  }

  function render(events) {
    const picks = choose(events);
    if (!picks.length) return;
    grid.innerHTML = picks.map(event => {
      const href = `/explore/?event=${encodeURIComponent(event.id)}`;
      return `<a class="pick-card" href="${href}"><div class="pick-image"><img src="${esc(imageSrc(event))}" alt="${esc(imageAlt(event))}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/editorial/explore-collage.webp'"></div><span class="kicker">${esc(labelFor(event))}</span><h3>${esc(event.title)}</h3><p class="pick-hook">${esc(event.summary || event.details || event.location)}</p></a>`;
    }).join('');
  }

  Promise.all([
    fetch('/data/explore-events.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {events:[]}).catch(() => ({events:[]})),
    fetch('/data/explore-events-nearby.json', {cache:'no-store'}).then(response => response.ok ? response.json() : {events:[]}).catch(() => ({events:[]}))
  ]).then(([primary, regional]) => render([...(primary.events || []), ...(regional.events || [])]));
})();
