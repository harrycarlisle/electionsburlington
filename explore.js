(() => {
  const qs = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
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
  const rank = window.CalendarRank || {};
  const torontoDayKey = rank.torontoDayKey || (value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  });
  const dayKey = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const dateFromKey = key => {
    const [year, month, day] = String(key || '').split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  };
  const todayKey = () => torontoDayKey(new Date());
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionBehavior = () => prefersReducedMotion() ? 'auto' : 'smooth';
  const eventCoversDay = (event, key) => rank.eventCoversDay
    ? rank.eventCoversDay(event, key)
    : dayKey(event.start) === key || (dayKey(event.start) <= key && dayKey(event.end) >= key);
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
  let selectedDate = todayKey();
  let calendarMode = 'next-7';
  let dayFilter = false;
  let showAll = false;
  let paintedRangeKey = '';
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

  function addDays(anchor, count) {
    const date = new Date(anchor);
    date.setDate(date.getDate() + count);
    date.setHours(12,0,0,0);
    return date;
  }

  function nextDays(count = 7, anchor = new Date()) {
    const start = new Date(anchor);
    start.setHours(12,0,0,0);
    return Array.from({length:count}, (_, index) => addDays(start, index));
  }

  function upcomingWeekend(anchor = new Date()) {
    const start = atStartOfDay(anchor);
    const day = start.getDay();
    const toSaturday = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
    const saturday = addDays(start, toSaturday);
    const sunday = addDays(saturday, 1);
    return { start: atStartOfDay(saturday), end: atEndOfDay(sunday) };
  }

  function paintWeek() {
    const days = nextDays(7, dateFromKey(todayKey()));
    qs('#weekStrip').innerHTML = days.map(date => {
      const key = dayKey(date);
      const hasEvent = events.some(event => eventCoversDay(event, key));
      const selected = dayFilter && selectedDate === key;
      return `<button class="day-button week-day ${selected ? 'is-selected' : ''} ${hasEvent ? 'has-event' : ''}" type="button" data-week-date="${key}" aria-selected="${selected ? 'true' : 'false'}" aria-label="Show events for ${date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}"><span>${date.toLocaleDateString('en-CA',{weekday:'short'})}</span><strong>${date.toLocaleDateString('en-CA',{month:'short',day:'numeric'})}</strong></button>`;
    }).join('');
    qs('#weekStrip').setAttribute('aria-label',`Next 7 days from ${days[0].toLocaleDateString('en-CA',{month:'long',day:'numeric',year:'numeric'})}`);
  }

  function monthsToPaint() {
    const { start, end } = rangeForMode(calendarMode);
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
    const last = new Date(end.getFullYear(), end.getMonth(), 1, 12);
    while (cursor.getTime() <= last.getTime() && months.length < 6) {
      months.push(new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    if (dayFilter && selectedDate) {
      const selected = dateFromKey(selectedDate);
      const stamp = new Date(selected.getFullYear(), selected.getMonth(), 1, 12).getTime();
      if (!months.some(month => month.getTime() === stamp)) {
        months.push(new Date(stamp));
        months.sort((a, b) => a - b);
      }
    }
    return months;
  }

  function monthBlock(first) {
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const today = todayKey();
    const cells = Array.from({length:leading}, () => '<span class="month-blank" aria-hidden="true"></span>');
    for (let number = 1; number <= daysInMonth; number += 1) {
      const date = new Date(first.getFullYear(), first.getMonth(), number, 12);
      const key = dayKey(date);
      const hasEvent = events.some(event => eventCoversDay(event, key));
      const selected = dayFilter && selectedDate === key;
      const past = key < today;
      cells.push(`<button class="month-day${hasEvent ? ' has-event' : ''}${selected ? ' is-selected' : ''}${past ? ' is-past' : ''}${key === today ? ' is-today' : ''}" type="button" data-date="${key}" aria-selected="${selected ? 'true' : 'false'}" aria-label="${date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}${hasEvent ? ', has events' : ''}">${number}</button>`);
    }
    const monthKey = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2,'0')}`;
    return `<section class="month-block" data-month="${monthKey}"><h3 class="month-label">${first.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h3><div class="month-grid" role="grid">${cells.join('')}</div></section>`;
  }

  function paintMonth(force = false) {
    const weekdays = qs('#monthWeekdays');
    const scroller = qs('#monthScroller') || qs('#monthCalendar');
    const months = monthsToPaint();
    const key = months.map(month => `${month.getFullYear()}-${month.getMonth()}`).join('|') + `|${events.length}`;
    if (weekdays) {
      weekdays.innerHTML = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<span class="month-weekday">${day}</span>`).join('');
    }
    if (!force && paintedRangeKey === key && scroller.querySelector('.month-day')) {
      updateSelectedMarks();
      return;
    }
    paintedRangeKey = key;
    scroller.innerHTML = months.map(monthBlock).join('');
    const todayButton = scroller.querySelector(`.month-day[data-date="${CSS.escape(todayKey())}"]`);
    if (todayButton && !dayFilter) {
      scrollSelectedDayIntoCalendar(todayButton, { behavior: 'auto' });
    }
  }

  function updateSelectedMarks() {
    document.querySelectorAll('.month-day[data-date]').forEach(button => {
      const on = dayFilter && button.dataset.date === selectedDate;
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.day-button[data-week-date]').forEach(button => {
      const on = dayFilter && button.dataset.weekDate === selectedDate;
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function scrollSelectedDayIntoCalendar(button, { behavior } = {}) {
    const scroller = qs('#monthScroller');
    const calendar = qs('#monthCalendar');
    if (!button || !scroller || !calendar || calendar.hidden) return;
    const scrollBehavior = behavior || motionBehavior();
    const align = () => {
      if (!document.contains(button) || calendar.hidden) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const label = button.closest('.month-block')?.querySelector('.month-label');
      const labelHeight = label ? label.getBoundingClientRect().height + 4 : 26;
      const delta = buttonRect.top - scrollerRect.top - labelHeight;
      if (Math.abs(delta) > 1) {
        scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta), behavior: scrollBehavior });
      }
    };
    align();
    requestAnimationFrame(() => requestAnimationFrame(align));
    if (scrollBehavior === 'smooth') window.setTimeout(align, 420);
    const card = qs('.calendar-card');
    const heading = qs('.explore-heading');
    if (!card) return;
    const headingBottom = heading ? heading.getBoundingClientRect().bottom : 8;
    const cardRect = card.getBoundingClientRect();
    if (cardRect.bottom < headingBottom + 48 || cardRect.top > window.innerHeight - 48) {
      card.scrollIntoView({ behavior: scrollBehavior, block: 'nearest', inline: 'nearest' });
    }
  }

  function selectDate(key, { sourceButton } = {}) {
    if (!key) return;
    selectedDate = key;
    dayFilter = true;
    showAll = false;
    updateSelectedMarks();
    paintEvents();
    const button = sourceButton && document.contains(sourceButton)
      ? sourceButton
      : qs(`.month-day[data-date="${CSS.escape(key)}"]`) || qs(`.day-button[data-week-date="${CSS.escape(key)}"]`);
    if (button) button.focus({ preventScroll: true });
    if (button && button.classList.contains('month-day')) {
      requestAnimationFrame(() => scrollSelectedDayIntoCalendar(button));
    }
  }

  const atStartOfDay = value => { const date = new Date(value); date.setHours(0,0,0,0); return date; };
  const atEndOfDay = value => { const date = new Date(value); date.setHours(23,59,59,999); return date; };
  const overlaps = (event, start, end) => new Date(event.end) >= start && new Date(event.start) <= end;

  function rangeForMode(mode) {
    const today = atStartOfDay(dateFromKey(todayKey()));
    if (mode === 'all') return { start: today, end: atEndOfDay(addDays(today, 400)) };
    if (mode === 'next-30') return { start: today, end: atEndOfDay(addDays(today, 29)) };
    if (mode === 'weekend') return upcomingWeekend(today);
    return { start: today, end: atEndOfDay(addDays(today, 6)) };
  }

  function rankedForSelectedDate() {
    if (rank.rankEventsForDate) return rank.rankEventsForDate(events, selectedDate);
    const onDay = events.filter(event => eventCoversDay(event, selectedDate));
    const later = events.filter(event => torontoDayKey(event.start) > selectedDate);
    return { onDay, later, ranked: onDay.concat(later) };
  }

  function visibleEvents() {
    const today = todayKey();
    const future = events.filter(event => torontoDayKey(event.end || event.start) >= today).sort((a,b) => new Date(a.start) - new Date(b.start));
    if (showAll) return future;
    if (dayFilter && selectedDate) return rankedForSelectedDate().ranked.slice(0, 6);
    const { start, end } = rangeForMode(calendarMode);
    const selected = future.filter(event => overlaps(event, start, end));
    const cap = calendarMode === 'next-30' || calendarMode === 'all' ? 6 : 3;
    return selected.slice(0, cap);
  }

  function setCalendarMode(mode) {
    calendarMode = mode;
    showAll = false;
    dayFilter = false;
    const isMonth = mode === 'next-30' || mode === 'all';
    qs('#weekStrip').hidden = isMonth;
    qs('#monthCalendar').hidden = !isMonth;
    if (qs('#calendarView')) qs('#calendarView').value = mode;
    paintedRangeKey = '';
    if (isMonth) paintMonth(true);
    else paintWeek();
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
    const empty = qs('#eventEmpty');
    if (dayFilter && selectedDate && !showAll) {
      const { onDay, later } = rankedForSelectedDate();
      if (!onDay.length) {
        const lines = rank.emptyDayMessage
          ? rank.emptyDayMessage(selectedDate, later[0])
          : [`No events found for ${selectedDate}.`];
        empty.hidden = false;
        empty.innerHTML = lines.map(line => `<p>${esc(line)}</p>`).join('');
      } else {
        empty.hidden = true;
        empty.innerHTML = '';
      }
    } else {
      empty.hidden = list.length > 0;
      empty.innerHTML = list.length ? '' : '<p>No verified events are listed for this day yet.</p>';
    }
    qs('#showAllEvents').textContent = showAll ? 'Show the next three' : 'Show all upcoming events';
  }

  function openEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;
    const saved = savedEvents.has(id);
    dialogContent.innerHTML = `${imageMarkup(event,'dialog-visual')}<div class="dialog-body"><span class="eyebrow">${esc(event.category)}${event.scope !== 'Burlington' ? ` · ${esc(event.scope)}` : ''}</span><h2>${esc(event.title)}</h2><div class="dialog-meta">${esc(event.dateLabel)} · ${esc(event.location)}</div><p>${esc(event.details)}</p>${event.bring?.length ? `<div class="bring-list"><strong>What to bring</strong><ul>${event.bring.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}<div class="dialog-actions"><a href="${esc(event.source)}" target="_blank" rel="noopener">Check official details</a><button type="button" id="dialogSave" data-id="${esc(id)}">${saved ? 'Saved ✓' : 'Save event'}</button></div><p class="publication-credit">Source: ${esc(event.sourceName)}. Event details were checked August 24, 2026.</p></div>`;
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
    qs('#savedEvents').innerHTML = list.length ? list.map(event => `<div class="saved-event"><time>${esc(event.dateLabel.split('·')[0])}</time><strong>${esc(event.title)}</strong><button type="button" data-remove-event="${esc(event.id)}" aria-label="Remove ${esc(event.title)}">×</button></div>`).join('') : '<p class="empty-note">Save an event and it will appear here.</p>';
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
    const actions = isBonus ? `<div class="passport-actions passport-bonus-actions"><a class="done-button" href="${esc(place.url)}" target="_blank" rel="noopener">Open bonus stop</a></div>` : `<div class="passport-actions"><button class="save-button ${isWanted ? 'is-saved' : ''}" type="button" data-want="${esc(place.id)}">${isWanted ? 'Want to go ✓' : 'Want to go'}</button><button class="done-button ${isDone ? 'is-done' : ''}" type="button" data-done="${esc(place.id)}">${isDone ? 'Done ✓' : 'Done'}</button><label class="save-button">Add photo<input type="file" accept="image/*" capture="environment" data-photo="${esc(place.id)}" hidden></label></div>`;
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
      selectDate(button.dataset.weekDate, { sourceButton: button });
    });
    qs('#monthCalendar').addEventListener('click', event => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      selectDate(button.dataset.date, { sourceButton: button });
    });
    qs('#monthCalendar').addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const button = event.target.closest('[data-date]');
      if (!button) return;
      event.preventDefault();
      selectDate(button.dataset.date, { sourceButton: button });
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
    qs('#passportRail').addEventListener('change', event => {
      const photo = event.target.closest('[data-photo]');
      if (photo && event.target.files?.[0]) {
        done.add(photo.dataset.photo);
        paintPassport();
        event.target.value = '';
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
      events = eventData.events || [];
      ideas = eventData.boredIdeas || [];
      places = placeData.places || [];
      bonus = placeData.bonus;
      paintWeek();
      paintMonth(true);
      paintEvents();
      paintPassport();
      installEvents();
      window.ExploreCalendar = {
        rankEventsForDate: (key, now) => rank.rankEventsForDate?.(events, key, now),
        eventCoversDay,
        formatDayLabel: rank.formatDayLabel,
        selectDate,
        selectedDate: () => selectedDate,
        dayFilter: () => dayFilter
      };
      window.BurlingtonIdeas?.setEvents?.(events);
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
