(() => {
  const qs = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const storage = {
    done: 'burlington-news-passport',
    want: 'burlington-news-passport-want',
    events: 'burlington-news-explore-saved'
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
  const imageMarkup = (item, className) => item.image
    ? `<div class="${className}"><img src="${esc(item.image)}" alt="${esc(item.imageAlt || '')}" loading="lazy">${item.credit ? `<span class="image-credit">${esc(item.credit)}</span>` : ''}</div>`
    : `<div class="${className}"><b>${esc(item.visualText || 'BURLINGTON')}</b></div>`;

  let events = [];
  let ideas = [];
  let places = [];
  let bonus = null;
  let selectedDate = dayKey(new Date());
  let showAll = false;
  let ideaIndex = 0;
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
      return `<button class="day-button ${selectedDate === key ? 'is-selected' : ''} ${hasEvent ? 'has-event' : ''}" type="button" data-date="${key}"><span>${date.toLocaleDateString('en-CA',{weekday:'short'})}</span><strong>${date.toLocaleDateString('en-CA',{month:'short',day:'numeric'})}</strong></button>`;
    }).join('');
  }

  function paintMonth() {
    const first = new Date();
    first.setDate(1);
    first.setHours(12,0,0,0);
    const monthMarkup = offset => {
      const start = new Date(first.getFullYear(), first.getMonth() + offset, 1, 12);
      const cells = [];
      const gridStart = new Date(start);
      gridStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const key = dayKey(date);
        const hasEvent = events.some(event => dayKey(event.start) === key);
        cells.push(`<button class="month-day ${hasEvent ? 'has-event' : ''} ${date.getMonth() !== start.getMonth() ? 'is-outside' : ''}" type="button" data-date="${key}" aria-label="${date.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}${hasEvent ? ', has events' : ''}">${date.getDate()}</button>`);
      }
      return `<h3 class="month-label">${start.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h3>${cells.join('')}`;
    };
    qs('#monthCalendar').innerHTML = `${monthMarkup(0)}${monthMarkup(1)}`;
  }

  function visibleEvents() {
    const now = new Date();
    const future = events.filter(event => new Date(event.end) >= now).sort((a,b) => new Date(a.start) - new Date(b.start));
    if (showAll) return future;
    const selected = future.filter(event => dayKey(event.start) === selectedDate || (dayKey(event.start) < selectedDate && dayKey(event.end) >= selectedDate));
    return selected.length ? selected.slice(0,3) : future.slice(0,3);
  }

  function eventCard(event) {
    const placeholder = event.image ? '' : ' is-placeholder';
    const nearby = event.scope !== 'Burlington' ? ' nearby' : '';
    return `<article class="event-card${placeholder}"><button class="event-open" type="button" data-event="${esc(event.id)}" aria-label="Open ${esc(event.title)}">${imageMarkup(event,'event-visual').replace('<div class="event-visual">',`<div class="event-visual"><span class="event-type${nearby}">${esc(event.category)}</span>`) }<div class="event-copy"><span class="event-meta">${esc(event.dateLabel)}</span><h3>${esc(event.title)}</h3><p class="event-place">⌖ ${esc(event.location)}</p></div></button></article>`;
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
    if (!ideas.length) return;
    const idea = ideas[ideaIndex % ideas.length];
    qs('#boredIdea').innerHTML = `${imageMarkup(idea,'bored-visual')}<div class="bored-copy"><strong>${esc(idea.title)}</strong><p>${esc(idea.copy)}</p></div>`;
    qs('#boredIdea').onclick = () => window.open(idea.url,'_blank','noopener');
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
    qs('#passportCount').textContent = `${done.size} of ${places.length} done`;
    qs('#passportProgress').style.width = `${places.length ? done.size / places.length * 100 : 0}%`;
    qs('#passportMap').querySelectorAll('.map-pin').forEach(pin => pin.remove());
    qs('#passportMap').insertAdjacentHTML('beforeend', places.map(place => `<button class="map-pin ${done.has(place.id) ? 'is-done' : ''}" type="button" style="left:${place.x}%;top:${place.y}%" data-place="${esc(place.id)}" aria-label="Show ${esc(place.title)}">${place.number}</button>`).join(''));
    const cards = places.map(place => passportCard(place)).join('');
    const unlocked = done.size === places.length;
    qs('#passportRail').innerHTML = `${cards}${passportCard(bonus, true, unlocked)}`;
  }

  function passportCard(place, isBonus = false, unlocked = false) {
    const isDone = done.has(place.id);
    const isWanted = wanted.has(place.id);
    const placeholder = place.image ? '' : ' is-placeholder';
    return `<article class="passport-card${isBonus ? ` bonus-card${unlocked ? ' is-unlocked' : ''}` : ''}${placeholder}" data-card-place="${esc(place.id)}">${isBonus && !unlocked ? '<span class="bonus-lock">Bonus · locked</span>' : ''}${imageMarkup(place,'passport-visual').replace('<div class="passport-visual">',`<div class="passport-visual"><span class="passport-number">${isBonus ? '★' : place.number}</span>`) }<div class="passport-copy"><h3>${esc(place.title)}</h3><p>${esc(place.copy)}</p><div class="passport-actions"><button class="save-button ${isWanted ? 'is-saved' : ''}" type="button" data-want="${esc(place.id)}" ${isBonus && !unlocked ? 'disabled' : ''}>${isWanted ? 'Want to go ✓' : 'Want to go'}</button><button class="done-button ${isDone ? 'is-done' : ''}" type="button" data-done="${esc(place.id)}" ${isBonus ? 'disabled' : ''}>${isDone ? 'Done ✓' : 'Done'}</button></div></div></article>`;
  }

  function scrollToPlace(id) {
    const card = qs(`[data-card-place="${CSS.escape(id)}"]`);
    card?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});
    qs('#passportMap').querySelectorAll('.map-pin').forEach(pin => pin.classList.toggle('is-active', pin.dataset.place === id));
  }

  function installEvents() {
    qs('#upcomingTab').addEventListener('click', () => setTab('upcoming'));
    qs('#myTab').addEventListener('click', () => setTab('my'));
    qs('#weekStrip').addEventListener('click', event => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      selectedDate = button.dataset.date;
      showAll = false;
      paintWeek();
      paintEvents();
    });
    qs('#monthToggle').addEventListener('click', () => {
      const calendar = qs('#monthCalendar');
      calendar.hidden = !calendar.hidden;
      qs('#monthToggle').setAttribute('aria-expanded', String(!calendar.hidden));
    });
    qs('#monthCalendar').addEventListener('click', event => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      selectedDate = button.dataset.date;
      showAll = false;
      paintEvents();
    });
    qs('#eventGrid').addEventListener('click', event => {
      const button = event.target.closest('[data-event]');
      if (button) openEvent(button.dataset.event);
    });
    qs('#showAllEvents').addEventListener('click', () => { showAll = !showAll; paintEvents(); });
    qs('#pickAnother').addEventListener('click', () => { ideaIndex = (ideaIndex + 1) % ideas.length; paintIdea(); });
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
    qs('#passportInfo').addEventListener('click', () => qs('#passportDialog').showModal());
    qs('#passportDialogClose').addEventListener('click', () => qs('#passportDialog').close());
    qs('#dialogClose').addEventListener('click', () => detailDialog.close());
    [detailDialog,qs('#passportDialog')].forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    }));
  }

  async function init() {
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
      paintIdea();
      paintPassport();
      installEvents();
    } catch (error) {
      qs('#eventGrid').innerHTML = '<p class="empty-note">The events calendar could not load. Try again shortly.</p>';
      console.error(error);
    }
  }

  init();
})();
