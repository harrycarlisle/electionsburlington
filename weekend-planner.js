(() => {
  'use strict';

  const TIME_ZONE = 'America/Toronto';
  const FALLBACK_IMAGE = '/assets/editorial/explore-collage.webp';
  const $ = selector => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function imagePath(value) {
    const path = String(value || FALLBACK_IMAGE);
    if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('/')) return path;
    return `/${path.replace(/^\.\//, '')}`;
  }

  function safeUrl(value, fallback = '#') {
    const url = String(value || '');
    return /^(?:https?:\/\/|\/)/i.test(url) ? url : fallback;
  }

  function eventDeepLink(event) {
    return event?.id ? `/explore/?event=${encodeURIComponent(event.id)}` : '/explore/';
  }

  function mapsSearchUrl(query) {
    const params = new URLSearchParams({ api: '1', query: String(query || 'Burlington, Ontario') });
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  function dateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function shiftKey(key, days) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days, 12));
    return date.toISOString().slice(0, 10);
  }

  function weekday(key) {
    return new Date(`${key}T12:00:00Z`).getUTCDay();
  }

  function weekendDays(today) {
    const day = weekday(today);
    const start = day === 0 || day === 6 ? today : shiftKey(today, (5 - day + 7) % 7);
    const count = day === 0 ? 1 : day === 6 ? 2 : 3;
    return Array.from({ length: count }, (_, index) => shiftKey(start, index));
  }

  function dayLabel(key, compact = false) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      weekday: compact ? 'short' : 'long',
      month: 'short',
      day: 'numeric'
    }).format(new Date(`${key}T12:00:00Z`));
  }

  function isLiveOn(event, key, today) {
    const start = String(event.start || '').slice(0, 10);
    const end = String(event.end || event.start || '').slice(0, 10);
    if (!start || start > key || end < key) return false;
    if (key === today && event.end && new Date(event.end).getTime() <= Date.now()) return false;
    return true;
  }

  function eventScore(event) {
    const local = String(event.scope || event.city || '').toLowerCase() === 'burlington' ? 4 : 0;
    return Number(event.weight || 0) + local;
  }

  function eventArea(event) {
    const place = `${event.location || ''} ${event.venue || ''} ${event.city || ''}`.toLowerCase();
    if (/spencer|brant|pearl|locust|downtown|lions park|ribfest|bpac/.test(place)) return 'downtown';
    if (/rbg|hendrie|plains|freeman|lift bridge|canal|west burlington/.test(place)) return 'west';
    if (/appleby|burloak|fairview|stoney|hamilton|winona|bronte/.test(place)) return 'east';
    return 'central';
  }

  function placeForArea(places, bonus, area, offset = 0) {
    const preferences = {
      downtown: ['brant-street-pier', 'public-art', 'joseph-brant-museum'],
      west: ['royal-botanical-gardens', 'freeman-station', 'lift-bridge'],
      east: ['bonus-stop', 'beachway', 'ireland-house'],
      central: ['ireland-house', 'kerncliff-park', 'freeman-station']
    };
    const pool = bonus ? [...places, bonus] : places;
    const ordered = (preferences[area] || preferences.central)
      .map(id => pool.find(place => place.id === id))
      .filter(Boolean);
    return ordered[offset % ordered.length] || pool[offset % pool.length];
  }

  function foodFor(foods, role, area, excluded = new Set()) {
    const roleMatches = foods.filter(food => (food.roles || []).includes(role) && !excluded.has(food.id));
    return roleMatches.find(food => food.area === area)
      || roleMatches.find(food => food.area === 'downtown')
      || roleMatches[0]
      || foods.find(food => !excluded.has(food.id));
  }

  function mapQuery(stop) {
    if (stop.kind === 'food') return stop.item.address;
    if (stop.kind === 'event') return stop.item.location;
    return `${stop.item.title}, Burlington, Ontario`;
  }

  function mapsUrl(stops) {
    const queries = stops.map(mapQuery).filter(Boolean);
    if (queries.length < 2) return 'https://www.google.com/maps/search/?api=1&query=Burlington%2C%20Ontario';
    const params = new URLSearchParams({
      api: '1',
      travelmode: 'driving',
      origin: queries[0],
      destination: queries[queries.length - 1]
    });
    if (queries.length > 2) params.set('waypoints', queries.slice(1, -1).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function stopDetails(stop) {
    if (stop.kind === 'food') return stop.item.dish;
    if (stop.kind === 'event') return stop.item.dateLabel || stop.item.location;
    return stop.item.copy;
  }

  function stopUrl(stop) {
    if (stop.kind === 'event') return eventDeepLink(stop.item);
    return safeUrl(stop.item.source || stop.item.url, mapsUrl([stop]));
  }

  function stopImage(stop) {
    return imagePath(stop.item.image);
  }

  function stopAlt(stop) {
    return stop.item.imageAlt || `${stop.item.title} in the Burlington weekend plan`;
  }

  function buildPlan(primary, places, bonus, foods) {
    const area = primary ? eventArea(primary) : 'downtown';
    const breakfast = foodFor(foods, 'morning', area);
    const usedFood = new Set(breakfast ? [breakfast.id] : []);
    const dinner = foodFor(foods, 'dinner', area, usedFood);
    const place = placeForArea(places, bonus, area);
    const secondaryPlace = placeForArea(places, bonus, area, 1);
    const stops = [];
    if (breakfast) stops.push({ kind: 'food', item: breakfast, label: 'Start · breakfast' });
    if (primary) stops.push({ kind: 'event', item: primary, label: `Main event · ${primary.category}` });
    else if (place) stops.push({ kind: 'place', item: place, label: 'Main stop · explore' });
    if (primary && place) stops.push({ kind: 'place', item: place, label: 'Then · wander' });
    else if (secondaryPlace) stops.push({ kind: 'place', item: secondaryPlace, label: 'Then · wander' });
    if (dinner) stops.push({ kind: 'food', item: dinner, label: 'Finish · eat here' });
    return stops;
  }

  function renderTabs(days, selected, onSelect) {
    const host = $('#dayTabs');
    host.innerHTML = days.map(key => `
      <button type="button" data-day="${key}" aria-pressed="${key === selected}">
        <span>${escapeHtml(dayLabel(key, true).replace(',', ''))}</span>
      </button>`).join('');
    host.querySelectorAll('[data-day]').forEach(button => {
      button.addEventListener('click', () => onSelect(button.dataset.day));
    });
  }

  function renderHero(primary, day, fallbackPlace) {
    const item = primary || fallbackPlace;
    const kind = primary ? `${primary.category} · ${primary.scope || primary.city || 'Burlington'}` : 'A Burlington day';
    const detail = primary ? (primary.location || primary.dateLabel) : 'A local stop worth the detour';
    const url = primary ? eventDeepLink(primary) : safeUrl(fallbackPlace?.url, '/explore/');
    const eventAttribute = primary ? ` data-event-id="${escapeHtml(primary.id)}"` : '';
    $('#weekendHero').innerHTML = `
      <img src="${escapeHtml(imagePath(item?.image))}" alt="${escapeHtml(item?.imageAlt || item?.title || 'Burlington weekend plan')}" width="1600" height="900">
      <div class="weekend-hero-shade"></div>
      <div class="weekend-hero-copy">
        <span>${escapeHtml(dayLabel(day))} · ${escapeHtml(kind)}</span>
        <h2>${escapeHtml(item?.title || 'Make a day of Burlington')}</h2>
        <p>${escapeHtml(detail)}</p>
        <a href="${escapeHtml(url)}"${eventAttribute} rel="noopener">View details <span aria-hidden="true">↗</span></a>
      </div>`;
  }

  function renderRoute(stops) {
    $('#planRoute').innerHTML = stops.map((stop, index) => `
      <a class="plan-card" href="${escapeHtml(stopUrl(stop))}"${stop.kind === 'event' ? ` data-event-id="${escapeHtml(stop.item.id)}"` : ''} rel="noopener">
        <figure>
          <img src="${escapeHtml(stopImage(stop))}" alt="${escapeHtml(stopAlt(stop))}" loading="lazy" width="800" height="600">
          <span class="route-number" aria-hidden="true">${index + 1}</span>
        </figure>
        <div class="plan-card-copy">
          <small>${escapeHtml(stop.label)}</small>
          <h3>${escapeHtml(stop.item.title)}</h3>
          <p>${escapeHtml(stopDetails(stop))}</p>
        </div>
      </a>`).join('');
    $('#routeMap').href = mapsUrl(stops);
  }

  function eventCard(event, selectedDay, today) {
    const isSelectedDay = isLiveOn(event, selectedDay, today);
    const label = isSelectedDay ? event.category : `Coming up · ${event.category}`;
    return `
      <a class="visual-card" href="${escapeHtml(eventDeepLink(event))}" data-event-id="${escapeHtml(event.id)}">
        <img src="${escapeHtml(imagePath(event.image))}" alt="${escapeHtml(event.imageAlt || event.title)}" loading="lazy" width="800" height="500">
        <div><small>${escapeHtml(label)}</small><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.dateLabel)}</p></div>
      </a>`;
  }

  function eventModal() {
    let host = $('#eventModal');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'eventModal';
    host.className = 'event-modal';
    host.hidden = true;
    document.body.append(host);
    return host;
  }

  function closeEventModal({ updateUrl = true } = {}) {
    const host = eventModal();
    if (host.hidden) return;
    const openerId = host.dataset.openerId || '';
    host.hidden = true;
    host.innerHTML = '';
    host.removeAttribute('data-event-id');
    document.body.classList.remove('event-modal-open');
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.delete('event');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (openerId) document.getElementById(openerId)?.focus();
  }

  function openEventModal(event, { updateUrl = true, opener = null } = {}) {
    if (!event) return;
    const host = eventModal();
    const address = event.location || event.venue || `${event.city || 'Burlington'}, Ontario`;
    const source = safeUrl(event.source, '#');
    const bring = Array.isArray(event.bring) ? event.bring.filter(Boolean) : [];
    const openerId = opener?.id || (opener ? `event-opener-${event.id}` : '');
    if (opener && !opener.id) opener.id = openerId;
    host.dataset.openerId = openerId;
    host.dataset.eventId = event.id || '';
    host.innerHTML = `
      <button class="event-modal-backdrop" type="button" data-event-close aria-label="Close event details"></button>
      <section class="event-dialog" role="dialog" aria-modal="true" aria-labelledby="eventDialogTitle" tabindex="-1">
        <button class="event-dialog-close" type="button" data-event-close aria-label="Close event details"><span aria-hidden="true">×</span></button>
        <img class="event-dialog-image" src="${escapeHtml(imagePath(event.image))}" alt="${escapeHtml(event.imageAlt || event.title)}" width="1200" height="675">
        <div class="event-dialog-copy">
          <p class="event-dialog-kicker">${escapeHtml(event.category || 'Event')}${event.scope || event.city ? ` · ${escapeHtml(event.scope || event.city)}` : ''}</p>
          <h2 id="eventDialogTitle">${escapeHtml(event.title)}</h2>
          <p class="event-dialog-meta">${escapeHtml(event.dateLabel || '')}</p>
          <a class="event-dialog-address" href="${escapeHtml(mapsSearchUrl(address))}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(address)} in Google Maps">
            <span aria-hidden="true">⌖</span>${escapeHtml(address)}<b aria-hidden="true">↗</b>
          </a>
          ${event.details || event.summary ? `<p class="event-dialog-details">${escapeHtml(event.details || event.summary)}</p>` : ''}
          ${bring.length ? `<div class="event-dialog-bring"><h3>What to bring</h3><ul>${bring.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
          <div class="event-dialog-actions">
            ${source !== '#' ? `<a class="event-dialog-primary" href="${escapeHtml(source)}" target="_blank" rel="noopener">Check official details <span aria-hidden="true">↗</span></a>` : ''}
            <a class="event-dialog-map" href="${escapeHtml(mapsSearchUrl(address))}" target="_blank" rel="noopener">Open in Google Maps</a>
          </div>
          ${event.sourceName ? `<p class="event-dialog-source">Source: ${escapeHtml(event.sourceName)}${event.verifiedAt ? `. Checked ${escapeHtml(new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(event.verifiedAt)))}` : ''}.</p>` : ''}
        </div>
      </section>`;
    host.hidden = false;
    document.body.classList.add('event-modal-open');
    host.querySelectorAll('[data-event-close]').forEach(button => button.addEventListener('click', () => closeEventModal()));
    host.querySelector('.event-dialog-image')?.addEventListener('error', imageEvent => {
      imageEvent.currentTarget.src = FALLBACK_IMAGE;
    }, { once: true });
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('event', event.id);
      history.pushState({ eventId: event.id }, '', `${url.pathname}${url.search}${url.hash}`);
    }
    requestAnimationFrame(() => host.querySelector('.event-dialog')?.focus());
  }

  function bindEventOpeners(events) {
    const byId = new Map(events.map(event => [String(event.id), event]));
    document.querySelectorAll('[data-event-id]').forEach(opener => {
      if (opener.dataset.eventBound === 'true') return;
      opener.dataset.eventBound = 'true';
      opener.addEventListener('click', clickEvent => {
        const event = byId.get(String(opener.dataset.eventId || ''));
        if (!event) return;
        clickEvent.preventDefault();
        openEventModal(event, { opener });
      });
    });
  }

  function renderMore(events, primary, selectedDay, weekend, today) {
    const weekendSet = new Set(weekend);
    const thisWeekend = events.filter(event => event.id !== primary?.id && [...weekendSet].some(day => isLiveOn(event, day, today)));
    const upcoming = events
      .filter(event => event.id !== primary?.id && String(event.start || '').slice(0, 10) > weekend[weekend.length - 1])
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const picks = [...thisWeekend, ...upcoming].filter((event, index, all) => all.findIndex(item => item.id === event.id) === index).slice(0, 4);
    $('#moreEvents').innerHTML = picks.length
      ? picks.map(event => eventCard(event, selectedDay, today)).join('')
      : '<p class="planner-empty">No other verified listings yet.</p>';
  }

  function renderLocal(places, bonus, usedPlace) {
    const pool = [...places, ...(bonus ? [bonus] : [])]
      .filter(place => place.id !== usedPlace?.id)
      .slice(0, 6);
    $('#localStops').innerHTML = pool.map(place => `
      <a class="local-card" href="${escapeHtml(safeUrl(place.url, '/explore/'))}" rel="noopener">
        <img src="${escapeHtml(imagePath(place.image))}" alt="${escapeHtml(place.imageAlt || place.title)}" loading="lazy" width="600" height="430">
        <span>${escapeHtml(place.title)}</span>
      </a>`).join('');
  }

  function installImageFallbacks() {
    document.querySelectorAll('.weekend-shell img').forEach(image => {
      image.addEventListener('error', () => {
        if (image.src.endsWith(FALLBACK_IMAGE)) return;
        image.src = FALLBACK_IMAGE;
      }, { once: true });
    });
  }

  async function init() {
    const [eventData, placeData, foodData] = await Promise.all([
      fetch('/data/explore-events.json', { cache: 'no-store' }).then(response => response.json()),
      fetch('/data/explore-places.json', { cache: 'no-store' }).then(response => response.json()),
      fetch('/data/explore-food.json', { cache: 'no-store' }).then(response => response.json())
    ]);
    const events = eventData.events || [];
    const places = placeData.places || [];
    const foods = foodData.spots || [];
    const today = dateKey(new Date());
    const days = weekendDays(today);
    let requestedEvent = new URLSearchParams(location.search).get('event') || '';
    const requestedRow = events.find(event => event.id === requestedEvent);
    let selected = days.find(day => requestedRow && isLiveOn(requestedRow, day, today)) || days[0];

    function render(day) {
      selected = day;
      const currentEvents = events
        .filter(event => isLiveOn(event, day, today))
        .sort((a, b) => eventScore(b) - eventScore(a) || new Date(a.start) - new Date(b.start));
      const primary = currentEvents.find(event => event.id === requestedEvent) || currentEvents[0] || null;
      const fallbackPlace = placeForArea(places, placeData.bonus, 'downtown');
      const plan = buildPlan(primary, places, placeData.bonus, foods);
      renderTabs(days, selected, nextDay => {
        requestedEvent = '';
        render(nextDay);
      });
      renderHero(primary, selected, fallbackPlace);
      renderRoute(plan);
      renderMore(events, primary, selected, days, today);
      renderLocal(places, placeData.bonus, plan.find(stop => stop.kind === 'place')?.item);
      bindEventOpeners(events);
      installImageFallbacks();
    }

    render(selected);
    if (requestedRow) openEventModal(requestedRow, { updateUrl: false });
    window.addEventListener('popstate', () => {
      const eventId = new URLSearchParams(location.search).get('event') || '';
      const row = events.find(event => event.id === eventId);
      if (row) openEventModal(row, { updateUrl: false });
      else closeEventModal({ updateUrl: false });
    });
    document.addEventListener('keydown', keyboardEvent => {
      if (keyboardEvent.key === 'Escape' && !eventModal().hidden) closeEventModal();
    });
  }

  init().catch(() => {
    $('#planRoute').innerHTML = '<p class="planner-empty">The current plan could not load. Try again shortly.</p>';
  });
})();
