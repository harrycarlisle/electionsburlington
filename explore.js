(() => {
  const qs = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const CLOSE_SVG = '<svg class="icon-close" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const storage = {
    done: 'burlington-news-passport',
    want: 'burlington-news-passport-want',
    events: 'burlington-news-explore-saved',
    bored: 'burlington-news-bored-prefs'
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
  const imageSrc = path => {
    const raw = String(path || '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    return raw.startsWith('/') ? raw : `/${raw}`;
  };
  const categoryArt = (item, className) => `<div class="${className} category-art category-${esc(String(item.category || item.visualText || 'local').toLowerCase().replace(/[^a-z]+/g,'-'))}"><span class="category-art-icon">${categoryIcon(item.category || item.visualText)}</span><span class="category-art-label">${esc(item.visualText || item.category || 'Local')}</span></div>`;
  const imageMarkup = (item, className) => item.image
    ? `<div class="${className}"><img src="${esc(imageSrc(item.image))}" alt="${esc(item.imageAlt || '')}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('category-art')">${item.credit && !item.illustration && !/^Burlington News/i.test(item.credit) ? `<span class="image-credit">${esc(item.credit)}</span>` : ''}</div>`
    : categoryArt(item, className);
  const addToVisual = (markup, content) => markup.replace(/^(<div class="[^"]+">)/, `$1${content}`);

  let events = [];
  let ideas = [];
  let places = [];
  let bonus = null;
  let selectedDate = dayKey(new Date());
  let calendarMode = 'next-7';
  let showAll = false;
  const done = readSet(storage.done);
  const wanted = readSet(storage.want);
  const savedEvents = readSet(storage.events);

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
    if (calendarMode === 'week') {
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
    }
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
    if (calendarMode === 'week' || calendarMode === 'next-7') {
      start = today;
      end = atEndOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6));
    }
    if (calendarMode === 'weekend') {
      const day = today.getDay();
      const toSaturday = (6 - day + 7) % 7;
      start = atStartOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + toSaturday));
      end = atEndOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1));
    }
    if (calendarMode === 'next-30') {
      start = today;
      end = atEndOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 29));
    }
    if (calendarMode === 'all') {
      return future.slice(0, showAll ? future.length : 8);
    }
    if (calendarMode === 'month' || calendarMode === 'next-month') {
      const offset = calendarMode === 'next-month' ? 1 : 0;
      start = new Date(today.getFullYear(),today.getMonth() + offset,1);
      end = atEndOfDay(new Date(today.getFullYear(),today.getMonth() + offset + 1,0));
    }
    const selected = future.filter(event => overlaps(event,start,end));
    return selected.slice(0, calendarMode === 'month' || calendarMode === 'next-30' ? 6 : 3);
  }

  function setCalendarMode(mode) {
    calendarMode = mode;
    showAll = false;
    const isMonth = mode === 'month' || mode === 'next-month';
    const titles = {
      today: 'Today',
      'next-7': 'This week',
      week: 'This week',
      weekend: 'This weekend',
      'next-30': 'Next 30 days',
      all: 'All dates',
      month: 'This month',
      'next-month': 'Next month'
    };
    qs('#calendarTitle').textContent = titles[mode] || 'This week';
    qs('#weekStrip').hidden = isMonth || mode === 'all' || mode === 'weekend' || mode === 'next-30';
    qs('#monthCalendar').hidden = !isMonth;
    if (qs('#calendarView').querySelector(`option[value="${mode}"]`)) qs('#calendarView').value = mode;
    if (isMonth) paintMonth(mode === 'next-month' ? 1 : 0);
    if (mode === 'next-7' || mode === 'week') paintWeek();
    paintEvents();
  }

  function eventCard(event) {
    const placeholder = event.image ? '' : ' is-placeholder';
    const nearby = event.scope !== 'Burlington' ? ' nearby' : '';
    return `<article class="event-card${placeholder}"><button class="event-open" type="button" data-event="${esc(event.id)}" aria-label="Open ${esc(event.title)}">${imageMarkup(event,'event-visual')}<div class="event-copy"><span class="event-type${nearby}">${esc(event.category)}</span><span class="event-meta">${esc(event.dateLabel)}</span><h3>${esc(event.title)}</h3><p class="event-place">⌖ ${esc(event.location)}</p></div></button></article>`;
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
    dialogContent.innerHTML = `${imageMarkup(event,'dialog-visual')}<div class="dialog-body"><span class="eyebrow">${esc(event.category)}${event.scope !== 'Burlington' ? ` · ${esc(event.scope)}` : ''}</span><h2>${esc(event.title)}</h2><div class="dialog-meta">${esc(event.dateLabel)} · ${esc(event.location)}</div><p>${esc(event.details)}</p>${event.bring?.length ? `<div class="bring-list"><strong>What to bring</strong><ul>${event.bring.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}<div class="dialog-actions"><a href="${esc(event.source)}" target="_blank" rel="noopener">Check official details</a><button type="button" id="dialogSave" data-id="${esc(id)}">${saved ? 'Saved ✓' : 'Save event'}</button></div><p class="publication-credit">Source: ${esc(event.sourceName)}. Event details were checked August 26, 2026.</p></div>`;
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
    else detailDialog.setAttribute('open','');
    qs('#dialogSave')?.addEventListener('click', () => {
      if (savedEvents.has(id)) savedEvents.delete(id); else savedEvents.add(id);
      writeSet(storage.events, savedEvents);
      qs('#dialogSave').textContent = savedEvents.has(id) ? 'Saved ✓' : 'Save event';
    });
  }

  function paintIdea() {
    const start = () => window.BurlingtonIdeas?.mountExplore(qs('#boredIdea'), qs('#pickAnother'));
    if (window.BurlingtonIdeas) return start();
    let tries = 0;
    const wait = setInterval(() => {
      if (window.BurlingtonIdeas || ++tries > 50) {
        clearInterval(wait);
        start();
      }
    }, 40);
  }

  function paintSavedEvents() {
    const list = events.filter(event => savedEvents.has(event.id));
    qs('#savedEvents').innerHTML = list.length ? list.map(event => `<div class="saved-event"><time>${esc(event.dateLabel.split('·')[0])}</time><strong>${esc(event.title)}</strong><button type="button" class="icon-action" data-remove-event="${esc(event.id)}" aria-label="Remove ${esc(event.title)}">${CLOSE_SVG}</button></div>`).join('') : '<p class="empty-note">Save an event and it will appear here.</p>';
  }

  function paintPassport() {
    done.forEach(id => { if (!places.some(place => place.id === id)) done.delete(id); });
    wanted.forEach(id => { if (!places.some(place => place.id === id)) wanted.delete(id); });
    writeSet(storage.done, done);
    writeSet(storage.want, wanted);
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
    const actions = isBonus ? `<div class="passport-actions passport-bonus-actions"><a class="done-button" href="${esc(place.url)}" target="_blank" rel="noopener">Open bonus stop</a></div>` : `<div class="passport-actions"><button class="save-button ${isWanted ? 'is-saved' : ''}" type="button" data-want="${esc(place.id)}">${isWanted ? 'Want to go ✓' : 'Want to go'}</button><button class="done-button ${isDone ? 'is-done' : ''}" type="button" data-done="${esc(place.id)}">${isDone ? 'Done ✓' : 'Done'}</button></div>`;
    return `<article class="passport-card${isBonus ? ' bonus-card is-unlocked' : ''}${placeholder}" data-card-place="${esc(place.id)}">${addToVisual(imageMarkup(place,'passport-visual'),`<span class="passport-number">${isBonus ? '13' : place.number}</span>`)}<div class="passport-copy"><h3>${esc(place.title)}</h3><p>${esc(place.copy)}</p>${actions}</div></article>`;
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
      qs('#calendarTitle').textContent = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});
      paintWeek();
      paintEvents();
    });
    qs('#monthCalendar').addEventListener('click', event => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      selectedDate = button.dataset.date;
      calendarMode = 'today';
      showAll = false;
      qs('#calendarTitle').textContent = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});
      paintMonth();
      paintEvents();
    });
    qs('#eventGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-event]');
      if (button) openEvent(button.dataset.event);
    });
    qs('#showAllEvents').addEventListener('click', () => { showAll = !showAll; paintEvents(); });
    qs('#savedEvents').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-event]');
      if (!button) return;
      savedEvents.delete(button.dataset.removeEvent);
      writeSet(storage.events, savedEvents);
      paintSavedEvents();
    });
    qs('#passportRail').addEventListener('click', event => {
      const wantButton = event.target.closest('[data-want]');
      const doneButton = event.target.closest('[data-done]');
      if (wantButton) {
        const id = wantButton.dataset.want;
        if (wanted.has(id)) wanted.delete(id); else wanted.add(id);
        paintPassport();
      }
      if (doneButton) {
        const id = doneButton.dataset.done;
        if (done.has(id)) done.delete(id); else done.add(id);
        paintPassport();
      }
    });
    qs('#passportMap').addEventListener('click', event => {
      const pin = event.target.closest('[data-place]');
      if (pin) scrollToPlace(pin.dataset.place);
    });
    qs('#passportNext').addEventListener('click', () => qs('#passportRail').scrollBy({left:260,behavior:'smooth'}));
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
      events = window.BurlingtonExploreRecurrence
        ? window.BurlingtonExploreRecurrence.mergeExploreEvents(eventData)
        : (eventData.events || []);
      ideas = eventData.boredIdeas || [];
      places = placeData.places || [];
      bonus = placeData.bonus;
      paintWeek();
      paintMonth();
      paintEvents();
      paintPassport();
      installEvents();
      paintIdea();
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
