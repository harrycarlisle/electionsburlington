(() => {
  const qs = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const storage = {
    done: 'burlington-news-passport',
    want: 'burlington-news-passport-want',
    events: 'burlington-news-explore-saved',
    bored: 'burlington-news-bored-prefs',
    root: 'burlington-news-explore-v1'
  };
  const readObject = key => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  };
  const writeObject = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  };
  const readSet = key => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch (_) { return new Set(); }
  };
  const writeSet = (key, set) => {
    try { localStorage.setItem(key, JSON.stringify([...set])); }
    catch (_) {}
  };
  const dayKey = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const categoryIcon = value => {
    const type = String(value || '').toLowerCase();
    if (type.includes('market')) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.5-5h-13L4 9Zm2 0v11h12V9M9 20v-6h6v6"/></svg>';
    if (type.includes('sky') || type.includes('moon')) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.8A8 8 0 0 1 9.2 4.5 8 8 0 1 0 19.5 14.8Z"/><path d="m17.5 4 .5 1.4 1.5.5-1.5.5-.5 1.4-.5-1.4-1.5-.5 1.5-.5.5-1.4Z"/></svg>';
    if (type.includes('concert') || type.includes('music')) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12M9 18c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2Zm10-2c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2Z"/></svg>';
    if (type.includes('volunteer')) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-9M12 14c-4 0-6-2-6-6 4 0 6 2 6 6Zm0 3c4 0 6-2 6-6-4 0-6 2-6 6Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>';
  };
  const imageMarkup = (item, className) => item.image
    ? `<div class="${className}"><img src="${esc(item.image)}" alt="${esc(item.imageAlt || '')}" loading="lazy">${item.credit && !item.illustration && !/^Burlington News/i.test(item.credit) ? `<span class="image-credit">${esc(item.credit)}</span>` : ''}</div>`
    : `<div class="${className} category-art category-${esc(String(item.category || item.visualText || 'local').toLowerCase().replace(/[^a-z]+/g,'-'))}"><span class="category-art-icon">${categoryIcon(item.category || item.visualText)}</span><span class="category-art-label">${esc(item.visualText || item.category || 'Local')}</span></div>`;
  const addToVisual = (markup, content) => markup.replace(/^(<div class="[^"]+">)/, `$1${content}`);

  let events = [];
  let ideas = [];
  let places = [];
  let bonus = null;
  let selectedDate = dayKey(new Date());
  let calendarMode = 'week';
  let showAll = false;
  let ideaIndex = 0;
  const done = readSet(storage.done);
  const wanted = readSet(storage.want);
  const savedEvents = readSet(storage.events);
  const boredPrefs = Object.assign({}, readObject(storage.bored), readObject(storage.root).bored || {});
  const rootState = readObject(storage.root);
  rootState.passport = rootState.passport || {};
  rootState.food = rootState.food || {};
  rootState.bored = boredPrefs;
  Object.entries(rootState.passport).forEach(([id, rec]) => {
    if (rec?.status === 'visited') done.add(id);
    if (rec?.status === 'planned') wanted.add(id);
  });
  done.forEach(id => {
    rootState.passport[id] = rootState.passport[id] || {status:'visited', visitedAt:new Date().toISOString(), verified:false};
  });
  wanted.forEach(id => {
    if (!done.has(id)) rootState.passport[id] = rootState.passport[id] || {status:'planned'};
  });

  const detailDialog = qs('#detailDialog');
  const dialogContent = qs('#dialogContent');

  function setTab(name) {
    const upcoming = name === 'upcoming';
    qs('#upcomingTab').classList.toggle('is-active', upcoming);
    qs('#myTab').classList.toggle('is-active', !upcoming);
    qs('#upcomingTab').setAttribute('aria-selected', String(upcoming));
    qs('#myTab').setAttribute('aria-selected', String(!upcoming));
    qs('#upcomingPanel').hidden = !upcoming;
    qs('#myPanel').hidden = upcoming;
    if (!upcoming) paintSavedEvents();
  }

  function weekDates(anchor = new Date()) {
    const start = new Date(anchor);
    start.setHours(12,0,0,0);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    return Array.from({length:7}, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  function paintWeek() {
    const days = weekDates();
    qs('#weekStrip').innerHTML = days.map(date => {
      const key = dayKey(date);
      const hasEvent = events.some(event => dayKey(event.start) === key || (new Date(event.start) <= date && new Date(event.end) >= date));
      return `<button class="day-button ${selectedDate === key ? 'is-selected' : ''} ${hasEvent ? 'has-event' : ''}" type="button" data-week-date="${key}" aria-label="Show events for ${date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}"><span>${date.toLocaleDateString('en-CA',{weekday:'short'})}</span><strong>${date.toLocaleDateString('en-CA',{month:'short',day:'numeric'})}</strong></button>`;
    }).join('');
    qs('#weekStrip').setAttribute('aria-label',`Week of ${days[0].toLocaleDateString('en-CA',{month:'long',day:'numeric',year:'numeric'})}`);
  }

  function paintMonth(offset = calendarMode === 'next-month' ? 1 : 0) {
    const first = new Date();
    first.setMonth(first.getMonth() + offset);
    first.setDate(1);
    first.setHours(12,0,0,0);
    const weekdayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<span class="month-weekday">${day}</span>`).join('');
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = Array.from({length:leading}, () => '<span class="month-blank" aria-hidden="true"></span>');
    for (let number = 1; number <= daysInMonth; number += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), number, 12);
      const key = dayKey(date);
      const hasEvent = events.some(event => dayKey(event.start) === key || (dayKey(event.start) < key && dayKey(event.end) >= key));
      cells.push(`<button class="month-day ${hasEvent ? 'has-event' : ''} ${selectedDate === key ? 'is-selected' : ''}" type="button" data-date="${key}" aria-label="${date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}${hasEvent ? ', has events' : ''}">${number}</button>`);
    }
    qs('#monthCalendar').innerHTML = `<h3 class="month-label">${first.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h3><div class="month-grid">${weekdayLabels}${cells.join('')}</div>`;
  }

  const atStartOfDay = value => { const date = new Date(value); date.setHours(0,0,0,0); return date; };
  const atEndOfDay = value => { const date = new Date(value); date.setHours(23,59,59,999); return date; };
  const overlaps = (event, start, end) => new Date(event.end) >= start && new Date(event.start) <= end;

  function visibleEvents() {
    const today = atStartOfDay(new Date());
    const future = events.filter(event => new Date(event.end) >= today).sort((a,b) => new Date(a.start) - new Date(b.start));
    if (showAll) return future;
    let start = calendarMode === 'today' ? atStartOfDay(new Date(`${selectedDate}T12:00:00`)) : today;
    let end = atEndOfDay(start);
    if (calendarMode === 'week') {
      const days = weekDates(today);
      start = atStartOfDay(days[0]);
      end = atEndOfDay(days[6]);
    }
    if (calendarMode === 'month' || calendarMode === 'next-month') {
      const offset = calendarMode === 'next-month' ? 1 : 0;
      start = new Date(today.getFullYear(),today.getMonth() + offset,1);
      end = atEndOfDay(new Date(today.getFullYear(),today.getMonth() + offset + 1,0));
    }
    const selected = future.filter(event => overlaps(event,start,end));
    return selected.slice(0, calendarMode === 'month' ? 6 : 3);
  }

  function setCalendarMode(mode) {
    calendarMode = mode;
    showAll = false;
    const isMonth = mode === 'month' || mode === 'next-month';
    qs('#calendarTitle').textContent = mode === 'today' ? 'Today' : mode === 'month' ? 'This month' : mode === 'next-month' ? 'Next month' : 'This week';
    qs('#weekStrip').hidden = isMonth;
    qs('#monthCalendar').hidden = !isMonth;
    qs('#calendarView').value = mode;
    if (isMonth) paintMonth(mode === 'next-month' ? 1 : 0);
    paintEvents();
  }

  function eventCard(event) {
    const placeholder = event.image ? '' : ' is-placeholder';
    const nearby = event.scope !== 'Burlington' ? ' nearby' : '';
    return `<article class="event-card${placeholder}"><button class="event-open" type="button" data-event="${esc(event.id)}" aria-label="Open ${esc(event.title)}">${addToVisual(imageMarkup(event,'event-visual'),`<span class="event-type${nearby}">${esc(event.category)}</span>`)}<div class="event-copy"><span class="event-meta">${esc(event.dateLabel)}</span><h3>${esc(event.title)}</h3><p class="event-place">⌖ ${esc(event.location)}</p></div></button></article>`;
  }

  function paintEvents() {
    const list = visibleEvents();
    qs('#eventGrid').innerHTML = list.map(eventCard).join('');
    qs('#eventEmpty').hidden = list.length > 0;
    qs('#showAllEvents').textContent = showAll ? 'Show the next three' : 'Show all upcoming events';
  }

  function openEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;
    const saved = savedEvents.has(id);
    dialogContent.innerHTML = `${imageMarkup(event,'dialog-visual')}<div class="dialog-body"><span class="eyebrow">${esc(event.category)}${event.scope !== 'Burlington' ? ` · ${esc(event.scope)}` : ''}</span><h2>${esc(event.title)}</h2><div class="dialog-meta">${esc(event.dateLabel)} · ${esc(event.location)}</div><p>${esc(event.details)}</p>${event.bring?.length ? `<div class="bring-list"><strong>What to bring</strong><ul>${event.bring.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}<div class="dialog-actions"><a href="${esc(event.source)}" target="_blank" rel="noopener">Check official details</a><a href="${esc(mapsUrl(event))}" target="_blank" rel="noopener">Directions</a><button type="button" id="dialogSave" data-id="${esc(id)}">${saved ? 'Saved ✓' : 'Save event'}</button></div><p class="publication-credit">Source: ${esc(event.sourceName)}. Event details were checked August 24, 2026.</p></div>`;
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
    else detailDialog.setAttribute('open','');
    qs('#dialogSave')?.addEventListener('click', () => {
      if (savedEvents.has(id)) savedEvents.delete(id); else savedEvents.add(id);
      writeSet(storage.events, savedEvents);
      qs('#dialogSave').textContent = savedEvents.has(id) ? 'Saved ✓' : 'Save event';
    });
  }

  function writeExploreState() {
    const latest = readObject(storage.root);
    latest.passport = rootState.passport;
    latest.bored = boredPrefs;
    latest.food = latest.food || rootState.food || {};
    writeObject(storage.root, latest);
  }
  function mapsUrl(item) {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    const query = item.googleMapsQuery || item.placeName || item.address;
    if (query) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    const fallback = item.location && item.location !== item.title ? item.location : 'Burlington, Ontario';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallback)}`;
  }
  function haversineMetres(aLat, aLon, bLat, bLon) {
    const toRad = n => n * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon/2)**2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
  function checkRadius(item) {
    if (Number.isFinite(Number(item.checkRadiusM))) return Number(item.checkRadiusM);
    const type = String(item.category || '').toLowerCase();
    if (/(park|garden|escarpment|waterfront|nature|market)/.test(type)) return 400;
    return 250;
  }
  function chooseIdea(fromIndex) {
    const now = Date.now();
    const scored = ideas.map((idea, index) => {
      const pref = boredPrefs[idea.id] || {};
      if (pref.skipUntil && pref.skipUntil > now) return {index, score: -1000};
      let score = Math.random();
      if (pref.like) score += 2;
      const liked = ideas.some(item => item.category && item.category === idea.category && boredPrefs[item.id]?.like);
      if (liked) score += 1;
      const categorySkipped = ideas.some(item => item.category === idea.category && (boredPrefs[item.id]?.skipUntil || 0) > now);
      if (categorySkipped) score -= 1;
      if (index === fromIndex) score -= 0.4;
      return {index, score};
    }).sort((a, b) => b.score - a.score);
    ideaIndex = (scored.find(item => item.score > -999) || scored[0] || {index:0}).index;
  }
  function paintIdea() {
    if (!ideas.length) return;
    const idea = ideas[ideaIndex % ideas.length];
    const pref = boredPrefs[idea.id] || {};
    const discover = !pref.planned && !pref.done;
    const actions = discover
      ? `<div class="bored-actions"><button type="button" data-bored="like" class="${pref.like?'is-on':''}">👍 Like this</button><button type="button" data-bored="skip">👎 Not for me</button><button type="button" data-bored="do">✓ Let’s do this</button></div>`
      : pref.done
        ? `<p class="place-done">Done</p><p class="bored-rate">How was it? ${[1,2,3,4,5].map(n => `<button type="button" data-bored-star="${n}" class="${(pref.rating||0)>=n?'is-on':''}">★</button>`).join('')}</p><a class="idea-map" href="${esc(mapsUrl(idea))}" target="_blank" rel="noopener">Open in Google Maps</a>`
        : `<p class="place-kicker">Planned</p><div class="bored-actions"><a class="idea-map" href="${esc(mapsUrl(idea))}" target="_blank" rel="noopener">Open in Google Maps</a><button type="button" data-bored="done">I went</button></div>`;
    qs('#boredIdea').innerHTML = `${imageMarkup(idea,'bored-visual')}<div class="bored-copy"><strong>${esc(idea.title)}</strong><p>${esc(idea.copy)}</p>${actions}</div>`;
  }

  function paintSavedEvents() {
    const list = events.filter(event => savedEvents.has(event.id));
    qs('#savedEvents').innerHTML = list.length ? list.map(event => `<div class="saved-event"><time>${esc(event.dateLabel.split('·')[0])}</time><strong>${esc(event.title)}</strong><button type="button" data-remove-event="${esc(event.id)}" aria-label="Remove ${esc(event.title)}">×</button></div>`).join('') : '<p class="empty-note">Save an event and it will appear here.</p>';
  }

  function paintPassport() {
    done.forEach(id => { if (!places.some(place => place.id === id)) done.delete(id); });
    wanted.forEach(id => { if (!places.some(place => place.id === id)) wanted.delete(id); });
    writeSet(storage.done, done);
    writeSet(storage.want, wanted);
    writeExploreState();
    qs('#passportCount').textContent = `${done.size} of ${places.length} explored`;
    qs('#passportProgress').style.width = `${places.length ? done.size / places.length * 100 : 0}%`;
    qs('#passportMap').querySelectorAll('.map-pin').forEach(pin => pin.remove());
    qs('#passportMap').insertAdjacentHTML('beforeend', places.map(place => `<button class="map-pin ${done.has(place.id) ? 'is-done' : ''}" type="button" style="left:${place.x}%;top:${place.y}%" data-place="${esc(place.id)}" aria-label="Show ${esc(place.title)}">${place.number}</button>`).join(''));
    const cards = places.map(place => passportCard(place)).join('');
    const unlocked = done.size === places.length;
    qs('#passportRail').innerHTML = `${cards}${passportCard(bonus, true, unlocked)}`;
  }

  function passportCard(place, isBonus = false, unlocked = false) {
    if (isBonus && !unlocked) return `<article class="passport-card bonus-card is-locked" data-card-place="${esc(place.id)}"><div class="bonus-teaser"><span class="bonus-lock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><small>Stop 13</small><strong>One more Burlington stop</strong><p>Explore all twelve places to reveal it.</p></div></article>`;
    const isDone = done.has(place.id);
    const isWanted = wanted.has(place.id);
    const placeholder = place.image ? '' : ' is-placeholder';
    const meta = rootState.passport[place.id] || {};
    let actions = '';
    if (isBonus) {
      actions = `<div class="passport-actions passport-bonus-actions"><a class="done-button" href="${esc(mapsUrl(place))}" target="_blank" rel="noopener">Directions</a></div>`;
    } else if (isDone) {
      const when = meta.visitedAt ? new Date(meta.visitedAt).toLocaleDateString('en-CA', {month:'short', day:'numeric'}) : '';
      actions = `<div class="passport-actions is-complete"><small>✓ Visited${meta.verified ? ' · Location confirmed' : ''}</small>${when ? `<em>${esc(when)}</em>` : ''}</div>`;
    } else if (isWanted) {
      actions = `<div class="passport-actions"><a class="save-button" href="${esc(mapsUrl(place))}" target="_blank" rel="noopener">Directions</a><button class="done-button" type="button" data-here="${esc(place.id)}">I'm here</button></div><p class="place-note" data-place-note="${esc(place.id)}" hidden></p>`;
    } else {
      actions = `<div class="passport-actions"><button class="save-button" type="button" data-want="${esc(place.id)}">Want to go</button><a class="done-button" href="${esc(mapsUrl(place))}" target="_blank" rel="noopener">Directions</a></div>`;
    }
    return `<article class="passport-card${isBonus ? ' bonus-card is-unlocked' : ''}${placeholder}${isDone ? ' is-visited' : ''}" data-card-place="${esc(place.id)}">${addToVisual(imageMarkup(place,'passport-visual'),`<span class="passport-number">${isBonus ? '13' : place.number}</span>`)}<div class="passport-copy"><h3>${esc(place.title)}</h3><p>${esc(place.copy)}</p>${actions}</div></article>`;
  }

  function scrollToPlace(id) {
    const card = qs(`[data-card-place="${CSS.escape(id)}"]`);
    card?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});
    qs('#passportMap').querySelectorAll('.map-pin').forEach(pin => pin.classList.toggle('is-active', pin.dataset.place === id));
  }

  function installEvents() {
    qs('#upcomingTab').addEventListener('click', () => setTab('upcoming'));
    qs('#myTab').addEventListener('click', () => setTab('my'));
    qs('#calendarView').addEventListener('change', event => setCalendarMode(event.target.value));
    qs('#weekStrip').addEventListener('click', event => {
      const button = event.target.closest('[data-week-date]');
      if (!button) return;
      selectedDate = button.dataset.weekDate;
      calendarMode = 'today';
      qs('#calendarView').value = 'today';
      qs('#calendarTitle').textContent = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});
      paintWeek();
      paintEvents();
    });
    qs('#monthCalendar').addEventListener('click', event => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      selectedDate = button.dataset.date;
      showAll = false;
      paintMonth();
      paintEvents();
    });
    qs('#eventGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-event]');
      if (button) openEvent(button.dataset.event);
    });
    qs('#showAllEvents').addEventListener('click', () => { showAll = !showAll; paintEvents(); });
    qs('#pickAnother').addEventListener('click', () => { chooseIdea(ideaIndex); paintIdea(); });
    qs('#boredIdea').addEventListener('click', event => {
      const idea = ideas[ideaIndex % ideas.length];
      if (!idea) return;
      const pref = boredPrefs[idea.id] || {category: idea.category};
      const star = event.target.closest('[data-bored-star]');
      const button = event.target.closest('[data-bored]');
      if (star) {
        pref.done = true;
        pref.planned = true;
        pref.rating = Number(star.dataset.boredStar);
        boredPrefs[idea.id] = pref;
        writeObject(storage.bored, boredPrefs);
        writeExploreState();
        paintIdea();
        return;
      }
      if (!button) return;
      if (button.dataset.bored === 'like') pref.like = !pref.like;
      if (button.dataset.bored === 'skip') {
        pref.skipUntil = Date.now() + 1000 * 60 * 60 * 24 * 30;
        pref.category = idea.category;
        chooseIdea(ideaIndex);
      }
      if (button.dataset.bored === 'do') pref.planned = true;
      if (button.dataset.bored === 'done') { pref.planned = true; pref.done = true; }
      boredPrefs[idea.id] = pref;
      writeObject(storage.bored, boredPrefs);
      writeExploreState();
      paintIdea();
    });
    qs('#savedEvents').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-event]');
      if (!button) return;
      savedEvents.delete(button.dataset.removeEvent);
      writeSet(storage.events, savedEvents);
      paintSavedEvents();
    });
    function markPassportVisited(id, verified) {
      done.add(id);
      wanted.delete(id);
      rootState.passport[id] = {status:'visited', visitedAt:new Date().toISOString(), verified:Boolean(verified)};
      paintPassport();
    }
    function checkPassportHere(id) {
      const place = places.find(item => item.id === id);
      const note = qs(`[data-place-note="${CSS.escape(id)}"]`);
      if (!place || !Number.isFinite(Number(place.latitude)) || !navigator.geolocation) {
        markPassportVisited(id, false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const metres = haversineMetres(pos.coords.latitude, pos.coords.longitude, Number(place.latitude), Number(place.longitude));
          if (metres <= checkRadius(place)) markPassportVisited(id, true);
          else if (note) {
            note.hidden = false;
            note.innerHTML = `You don’t appear to be near this location yet. <button type="button" class="place-link" data-anyway="${esc(id)}">Mark visited anyway</button>`;
          } else markPassportVisited(id, false);
        },
        () => markPassportVisited(id, false),
        {enableHighAccuracy:false, timeout:8000, maximumAge:0}
      );
    }
    qs('#passportRail').addEventListener('click', event => {
      const wantButton = event.target.closest('[data-want]');
      const hereButton = event.target.closest('[data-here]');
      const anywayButton = event.target.closest('[data-anyway]');
      if (wantButton) {
        const id = wantButton.dataset.want;
        if (wanted.has(id)) {
          wanted.delete(id);
          delete rootState.passport[id];
        } else {
          wanted.add(id);
          rootState.passport[id] = {status:'planned'};
        }
        paintPassport();
      }
      if (hereButton) checkPassportHere(hereButton.dataset.here);
      if (anywayButton) markPassportVisited(anywayButton.dataset.anyway, false);
    });
    qs('#passportMap').addEventListener('click', event => {
      const pin = event.target.closest('[data-place]');
      if (pin) scrollToPlace(pin.dataset.place);
    });
    qs('#passportNext').addEventListener('click', () => qs('#passportRail').scrollBy({left:320,behavior:'smooth'}));
    qs('#passportInfo').addEventListener('click', () => {
      const dialog = qs('#passportDialog');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open','');
    });
    qs('#passportDialogClose').addEventListener('click', () => qs('#passportDialog').close());
    qs('#dialogClose').addEventListener('click', () => detailDialog.close());
    [detailDialog,qs('#passportDialog')].forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    }));
  }

  async function init() {
    if (!qs('#eventGrid') || !qs('#boredIdea') || !qs('#passportRail')) return;
    try {
      const [eventResponse, placeResponse] = await Promise.all([fetch('/data/explore-events.json'),fetch('/data/explore-places.json')]);
      if (!eventResponse.ok || !placeResponse.ok) throw new Error('Explore data unavailable');
      const eventData = await eventResponse.json();
      const placeData = await placeResponse.json();
      events = eventData.events || [];
      ideas = eventData.boredIdeas || [];
      places = placeData.places || [];
      bonus = placeData.bonus;
      paintWeek();
      paintMonth();
      paintEvents();
      chooseIdea();
      paintIdea();
      paintPassport();
      installEvents();
      const hash = location.hash.replace('#event-','');
      if (hash && events.some(item => item.id === hash)) openEvent(hash);
    } catch (error) {
      const grid = qs('#eventGrid');
      if (grid) grid.innerHTML = '<p class="empty-note">The events calendar could not load. Try again shortly.</p>';
      console.error(error);
    }
  }

  init();
})();
