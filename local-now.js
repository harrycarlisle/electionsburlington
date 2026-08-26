(() => {
  const host = document.getElementById('localNow');
  if (!host) return;

  const VARIANT = 'mode-tabs';
  const MODE_KEY = 'liveUtilityMode';
  const MODES = ['driving', 'go', 'skyway', 'today'];
  const MODE_LABEL = {driving:'Driving', go:'GO', skyway:'Skyway', today:'Today'};

  window.liveUtilityVariant = VARIANT;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const torontoDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(value ? new Date(value) : new Date());
  const goTripUrl = destination => `https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(torontoDay())}&transfers=true`;
  const torontoHour = (value) => Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', hour:'numeric', hourCycle:'h23'}).format(value ? new Date(value) : new Date()));
  const torontoMinute = (value) => Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', minute:'2-digit'}).format(value ? new Date(value) : new Date()));

  let selectedMode = null;
  let viewed = false;
  let lastModels = null;

  function track(name, mode) {
    const detail = {event:name, liveUtilityVariant:VARIANT, mode:mode || selectedMode || 'driving'};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(detail);
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(name, {detail})); } catch (_) {}
  }

  function readStoredMode() {
    try {
      const value = String(localStorage.getItem(MODE_KEY) || '').toLowerCase();
      return MODES.includes(value) ? value : '';
    } catch (_) {
      return '';
    }
  }

  function storeMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}
  }

  function timeOnly(value) {
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour24 = Number(match[1]) % 24;
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    const hour = hour24 % 12 || 12;
    return `${hour}:${match[2]} ${suffix}`;
  }

  function journeyMinutes(journey) {
    const raw = journey?.computedDeparture || journey?.departure;
    const match = String(raw || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function departureLabel(journey) {
    const raw = journey?.computedDeparture || journey?.departure;
    const time = timeOnly(raw);
    if (!time) return '';
    const status = String(journey.departureStatus || '');
    if (journey.computedDeparture && /late|delay|delayed/i.test(status)) return `${time} delayed`;
    return time;
  }

  function routeJourneys(data, code, count) {
    const route = (Array.isArray(data?.routes) ? data.routes : []).find(item => String(item.destination?.stopCode || '').toUpperCase() === code);
    const all = Array.isArray(route?.journeys) ? route.journeys : [];
    const fresh = data?.generatedAt && torontoDay(data.generatedAt) === torontoDay();
    const nowMin = torontoHour() * 60 + torontoMinute();
    const upcoming = fresh ? all.filter(item => {
      const minutes = journeyMinutes(item);
      return minutes == null || minutes >= nowMin - 4;
    }) : all;
    return (upcoming.length ? upcoming : all).slice(0, count);
  }

  function goModel(data) {
    const alert = Array.isArray(data?.alerts) && data.alerts[0];
    const union = routeJourneys(data, 'UN', 2);
    const west = routeJourneys(data, 'WR', 2);
    const scheduled = String(data?.dataKind || '').toLowerCase() === 'scheduled' || union.concat(west).every(item => item.scheduled !== false && !item.computedDeparture);
    const severe = Boolean(alert) && /cancel|cancelled|suspend|severe|stopped|stoppage|delay|disruption|bus replace/i.test(`${alert.headline || ''} ${alert.description || ''}`);
    return {
      alert: Boolean(alert),
      severe,
      headline: alert?.headline || 'Service alert',
      scheduled,
      dataKind: data?.dataKind || (scheduled ? 'scheduled' : 'live'),
      url: data?.liveStatusUrl || 'https://www.gotransit.com/en/see-schedules',
      lines: [
        {code:'UN', label:'Burlington → Union', url:goTripUrl('UN'), journeys:union},
        {code:'WR', label:'Burlington → West Harbour', url:goTripUrl('WR'), journeys:west}
      ]
    };
  }

  function prettyDate(value) {
    const raw = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', month:'short', day:'numeric'}).format(new Date(value));
    return raw.replace(/\b([A-Za-z]{3})\s/, '$1. ');
  }

  function clockLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const hour = torontoHour(date);
    const minute = torontoMinute(date);
    const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
    const display = hour % 12 || 12;
    return minute ? `${display}:${String(minute).padStart(2, '0')} ${suffix}` : `${display} ${suffix}`;
  }

  function shiftDay(ymd, delta) {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Intl.DateTimeFormat('en-CA', {timeZone:'UTC', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(Date.UTC(year, month - 1, day + delta, 12)));
  }

  function relativeDay(start) {
    const day = torontoDay(start);
    const today = torontoDay();
    if (day === today) return torontoHour(start) >= 17 ? 'Tonight' : 'Today';
    if (day === shiftDay(today, 1)) return 'Tomorrow';
    const weekday = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', weekday:'short'}).format(new Date(start));
    const todayWeekday = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', weekday:'short'}).format(new Date());
    const weekend = /Sat|Sun/i.test(weekday);
    const approaching = /Thu|Fri|Sat|Sun/i.test(todayWeekday);
    if (weekend && approaching) return 'This weekend';
    return weekday;
  }

  function nextEvent(data) {
    const now = Date.now();
    const events = (Array.isArray(data?.events) ? data.events : []).filter(item => Date.parse(item.end || item.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const event = events[0];
    if (!event) return null;
    const start = event.start ? new Date(event.start) : null;
    const end = event.end ? new Date(event.end) : null;
    const hours = start && Number.isFinite(start.getTime())
      ? (end && Number.isFinite(end.getTime()) ? `${clockLabel(start)}–${clockLabel(end)}` : clockLabel(start))
      : '';
    return {
      title: event.title || 'Burlington event',
      relative: start ? relativeDay(start) : '',
      dateLabel: start ? prettyDate(start) : (event.dateLabel || ''),
      hours,
      url: `/explore/#event-${encodeURIComponent(event.id || '')}`
    };
  }

  function shortPlace(value) {
    return String(value || '')
      .replace(/\s+(Drive|Rd|Road|Avenue|Ave|Street|St|Boulevard|Blvd|Line)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function destinationFrom(item) {
    const hay = `${item.direction || ''} ${item.title || ''} ${item.impact || ''} ${item.context || ''}`;
    if (/niagara|fort erie/i.test(hay)) return 'Niagara';
    if (/hamilton/i.test(hay) && !/toronto/i.test(hay)) return 'Hamilton';
    if (/oakville or toronto|toronto/i.test(hay)) return 'Toronto';
    if (/oakville/i.test(hay)) return 'Oakville';
    return torontoHour() >= 15 ? 'Hamilton' : 'Toronto';
  }

  function roadwayFrom(item) {
    const match = /\b(QEW|403|407|401)\b/i.exec(`${item.roadway || ''} ${item.title || ''}`);
    return match ? match[1].toUpperCase() : 'QEW';
  }

  function delayMinutesFrom(item) {
    const fields = [item.delayMinutes, item.delay, item.minutes, item.status?.delayMinutes];
    for (const value of fields) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return Math.round(number);
    }
    const text = `${item.impact || ''} ${item.context || ''} ${item.title || ''}`;
    const match = text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*min/i) || text.match(/\+(\d{1,2})\s*min/i) || text.match(/\b(\d{1,2})\s*minutes?\b/i);
    if (match) return Number(match[2] || match[1]);
    return null;
  }

  function drivingModel(surface, intel) {
    const incidents = Array.isArray(surface?.incidents) ? surface.incidents : [];
    const ready = surface?.homepageTraffic;
    const local = incidents.find(item => /burlington/i.test(item.municipality || '') && (item.type === 'closure' || item.type === 'collision'))
      || incidents.find(item => item.type === 'closure' || item.type === 'collision');
    const commute = surface?.routes?.toronto || surface?.routes?.hamilton || {};
    const source = local || (ready?.title ? {
      title: ready.title,
      context: ready.context || '',
      impact: ready.impact || '',
      direction: '',
      municipality: /burlington/i.test(ready.context || '') ? 'Burlington' : '',
      nearestRoad: '',
      type: /clos/i.test(ready.title) ? 'closure' : (/collision|crash/i.test(ready.title) ? 'collision' : ''),
      roadway: '',
      rawHeadline: ''
    } : null);

    if (source || ready?.title) {
      const item = source || {};
      const dest = destinationFrom({...item, impact: ready?.impact || item.impact, title: ready?.title || item.title});
      const road = roadwayFrom({...item, title: ready?.title || item.title});
      const place = shortPlace(item.nearestRoad || (ready?.context || '').split('·').pop() || '');
      const type = String(item.type || (/clos/i.test(ready?.title || '') ? 'closure' : (/collision|crash/i.test(ready?.title || '') ? 'collision' : '')));
      const minutes = delayMinutesFrom(item) || delayMinutesFrom(ready || {});
      const laneClosed = /lane closed|lanes closed|all lanes/i.test(`${item.rawHeadline || ''} ${item.title || ''} ${ready?.title || ''}`);
      const intensity = type === 'closure' || laneClosed ? 'Heavy' : (type === 'collision' ? 'Heavy' : (/delay/i.test(commute?.status?.level || '') ? 'Moderate' : ''));
      const eventLabel = type === 'closure' ? 'Closure' : (type === 'collision' ? 'Collision' : 'Incident');
      const placeLine = place
        ? (type === 'collision' || type === 'closure' ? `${eventLabel} near ${place}` : `${intensity || 'Watch'} near ${place}`)
        : (ready?.context || item.context || '');
      const metric = minutes
        ? `+${minutes} min`
        : (type || ready?.alert ? 'Delay likely' : (intensity ? `${intensity}` : 'Clear'));
      const major = Boolean((ready?.alert || type === 'collision' || type === 'closure') && (/burlington/i.test(item.municipality || ready?.context || '') || /qew|403|skyway/i.test(`${item.roadway || ''} ${ready?.title || item.title || ''}`)));
      return {
        alert: Boolean(ready?.alert || type),
        major,
        kicker: 'Traffic now',
        title: `${road} → ${dest}`,
        metric,
        detail: intensity && place ? `${intensity} near ${place}` : placeLine,
        extra: minutes && (type === 'collision' || type === 'closure') && place ? `${eventLabel} near ${place}` : '',
        url: ready?.url || '/traffic/'
      };
    }

    const top = intel?.topSignal;
    if (top && Number(top.score) >= 90 && /collision|closure|closed/i.test(`${top.headline || ''}`)) {
      return {
        alert:true, major:true, kicker:'Traffic now', title:top.headline, metric:'Delay likely',
        detail:top.location || '', extra:'', url:top.url || '/traffic/'
      };
    }

    const dest = torontoHour() >= 15 ? 'Hamilton' : 'Toronto';
    const looks = String(commute?.status?.looks || commute?.status?.level || '').toLowerCase();
    if (looks && looks !== 'unknown' && looks !== 'check cameras') {
      return {
        alert:false, major:false, kicker:'Traffic now', title:`QEW → ${dest}`,
        metric: looks === 'heavy' ? 'Heavy' : (looks === 'moderate' ? 'Moderate' : 'Light'),
        detail: looks === 'clear' || looks === 'light' ? 'No major delay' : 'Live conditions',
        extra:'', url:'/traffic/'
      };
    }

    return {
      alert:false, major:false, kicker:'Traffic now', title:`QEW → ${dest}`,
      metric:'Clear', detail:'No major delay', extra:'', url:'/traffic/'
    };
  }

  function skywayModel(surface) {
    const skyway = surface?.skyway || {};
    const incidents = (Array.isArray(surface?.incidents) ? surface.incidents : []).filter(item => item.affectsSkyway);
    const major = incidents.find(item => item.type === 'collision' || item.type === 'closure');
    const watch = incidents.find(item => item.type === 'construction');
    const raw = String(skyway.value || '').trim();
    const looks = /^(light|moderate|heavy|clear|slow)$/i.test(raw) ? raw.toLowerCase() : '';

    if (major) {
      const dest = /fort erie|niagara|hamilton/i.test(`${major.direction || ''} ${major.title || ''}`) ? 'Niagara-bound' : 'Toronto-bound';
      const minutes = delayMinutesFrom(major);
      return {
        alert:true, major:true, kicker:'Skyway',
        title: major.type === 'closure' ? `Closed ${dest}` : `Heavy ${dest}`,
        metric: minutes ? `+${minutes} min` : 'Delay likely',
        detail: shortPlace(major.nearestRoad) ? `${major.type === 'closure' ? 'Closure' : 'Collision'} near ${shortPlace(major.nearestRoad)}` : (major.title || ''),
        url:'/traffic/'
      };
    }

    if (looks) {
      const title = looks === 'heavy' ? 'Heavy Toronto-bound' : looks === 'light' || looks === 'clear' ? 'Light' : 'Moderate';
      return {
        alert: looks === 'heavy', major: looks === 'heavy', kicker:'Skyway', title,
        metric: looks === 'heavy' ? 'Slow near bridge' : (looks === 'light' || looks === 'clear' ? 'All monitored approaches moving' : 'Slow near bridge'),
        detail:'', url:'/traffic/'
      };
    }

    if (watch) {
      return {
        alert:false, major:false, kicker:'Skyway',
        title:'Watch',
        metric:'Construction nearby',
        detail: shortPlace(watch.nearestRoad) ? `Near ${shortPlace(watch.nearestRoad)}` : 'On a monitored approach',
        url:'/traffic/'
      };
    }

    return {
      alert:false, major:false, kicker:'Skyway',
      title:'Looks moderate from live cameras',
      metric:'',
      detail:'Cameras are the detail view',
      url:'/traffic/',
      lowConfidence:true
    };
  }

  function chooseDefault(models) {
    if (models.driving.major) return 'driving';
    if (models.go.severe) return 'go';
    if (models.skyway.major) return 'skyway';
    return readStoredMode() || 'driving';
  }

  const icon = (name, path) => `<span class="now-icon now-icon-${name}" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
  const icons = {
    driving: icon('traffic', '<path d="M5 15.5v-2c0-.5.3-1 .7-1.3l1.6-1.1 1.1-2c.3-.5.8-.8 1.4-.8h4.4c.6 0 1.1.3 1.4.8l1.1 2 1.6 1.1c.4.3.7.8.7 1.3v2"/><circle cx="8" cy="16.2" r="1.3"/><circle cx="16" cy="16.2" r="1.3"/><path d="M8.6 11.2h6.8"/>'),
    go: icon('go', '<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4"/>'),
    skyway: icon('skyway', '<path d="M3 16h18M5 16c2-6 5-9 7-9s5 3 7 9"/><path d="M8 16v-3M16 16v-3"/>'),
    today: icon('next', '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>')
  };

  function drivingCard(model) {
    const detail = model.detail || model.extra;
    return `<a class="now-mode-card now-card-driving${model.alert ? ' is-alert' : ''}" href="${esc(model.url)}" data-utility-card="driving">
      <small>Traffic now</small>
      <span class="now-card-head">${icons.driving}<strong>${esc(model.title)}</strong></span>
      <span class="now-card-metrics">${model.metric ? `<b>${esc(model.metric)}</b>` : ''}${detail ? `<em>${esc(detail)}</em>` : ''}</span>
    </a>`;
  }

  function goCard(model) {
    if (model.alert) {
      return `<a class="now-mode-card now-card-go is-alert" href="${esc(model.url)}" data-utility-card="go">
        <small>GO</small>
        <span class="now-card-head">${icons.go}<strong>${esc(model.headline)}</strong></span>
        <span class="now-card-metrics"><em>Live service update</em></span>
      </a>`;
    }
    const lines = model.lines.map(line => {
      const next = departureLabel(line.journeys[0]);
      const follow = departureLabel(line.journeys[1]);
      return `<span class="now-go-line"><span class="now-go-route">${esc(line.label)}</span><span class="now-go-times"><b>${esc(next || 'See schedule')}</b>${follow ? `<em>${esc(follow)}</em>` : ''}</span></span>`;
    }).join('');
    return `<a class="now-mode-card now-card-go" href="${esc(model.url)}" data-utility-card="go" target="_blank" rel="noopener">
      <small>GO</small>
      ${model.scheduled ? '<span class="now-subtle">Scheduled</span>' : ''}
      <span class="now-go-lines">${lines}</span>
    </a>`;
  }

  function skywayCard(model) {
    return `<a class="now-mode-card now-card-skyway${model.alert ? ' is-alert' : ''}" href="${esc(model.url)}" data-utility-card="skyway">
      <small>Skyway</small>
      <span class="now-card-head">${icons.skyway}<strong>${esc(model.title)}</strong></span>
      <span class="now-card-metrics">${model.metric ? `<b>${esc(model.metric)}</b>` : ''}${model.detail ? `<em>${esc(model.detail)}</em>` : ''}</span>
    </a>`;
  }

  function todayCard(model) {
    if (!model) {
      return `<a class="now-mode-card now-card-today" href="/explore/" data-utility-card="today">
        <small>Next</small>
        <span class="now-card-head">${icons.today}<strong>See Burlington events</strong></span>
      </a>`;
    }
    const when = [model.relative, model.dateLabel].filter(Boolean).join(' · ');
    return `<a class="now-mode-card now-card-today" href="${esc(model.url)}" data-utility-card="today">
      <small>Next</small>
      ${when ? `<span class="now-card-when">${esc(when)}</span>` : ''}
      <span class="now-card-head">${icons.today}<strong>${esc(model.title)}</strong></span>
      ${model.hours ? `<span class="now-card-metrics"><em>${esc(model.hours)}</em></span>` : ''}
    </a>`;
  }

  function cardFor(mode, models) {
    if (mode === 'go') return goCard(models.go);
    if (mode === 'skyway') return skywayCard(models.skyway);
    if (mode === 'today') return todayCard(models.today);
    return drivingCard(models.driving);
  }

  function applyMode(mode, focusTab) {
    if (!lastModels || !MODES.includes(mode)) return;
    selectedMode = mode;
    storeMode(mode);
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    tabs.forEach(tab => {
      const on = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-active', on);
      if (on && focusTab) tab.focus();
    });
    const panel = host.querySelector('[role="tabpanel"]');
    if (panel) {
      panel.id = `nowPanel-${mode}`;
      panel.setAttribute('aria-labelledby', `nowTab-${mode}`);
      panel.innerHTML = cardFor(mode, lastModels);
      panel.querySelector('[data-utility-card]')?.addEventListener('click', () => track('live_utility_card_click', mode));
    }
    tabs.forEach(tab => tab.setAttribute('aria-controls', `nowPanel-${mode}`));
  }

  function bindTabs() {
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        if (tab.dataset.mode === selectedMode) return;
        applyMode(tab.dataset.mode);
        track('live_utility_mode_change', tab.dataset.mode);
      });
      tab.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else if (event.key === 'Enter' || event.key === ' ') next = index;
        else return;
        event.preventDefault();
        const mode = tabs[next].dataset.mode;
        if (mode !== selectedMode) track('live_utility_mode_change', mode);
        applyMode(mode, true);
      });
    });
  }

  function render(payload) {
    const models = {
      driving: drivingModel(payload.surface, payload.intel),
      go: goModel(payload.go),
      skyway: skywayModel(payload.surface),
      today: nextEvent(payload.explore)
    };
    lastModels = models;
    const initial = selectedMode || chooseDefault(models);
    selectedMode = initial;

    host.dataset.liveUtilityVariant = VARIANT;
    host.innerHTML = `
      <p class="now-kicker"><i class="now-dot" aria-hidden="true"></i> Live local update</p>
      <div class="now-tabs" role="tablist" aria-label="Live local update">
        ${MODES.map(mode => `<button type="button" class="now-tab now-tab-${mode}${mode === initial ? ' is-active' : ''}" role="tab" id="nowTab-${mode}" data-mode="${mode}" aria-selected="${mode === initial}" aria-controls="nowPanel-${initial}" tabindex="${mode === initial ? 0 : -1}">${icons[mode]}<span>${MODE_LABEL[mode]}</span></button>`).join('')}
      </div>
      <div class="now-panel" role="tabpanel" id="nowPanel-${initial}" aria-labelledby="nowTab-${initial}">
        ${cardFor(initial, models)}
      </div>`;
    bindTabs();
    host.querySelector('[data-utility-card]')?.addEventListener('click', () => track('live_utility_card_click', initial));
    if (!viewed) {
      viewed = true;
      track('live_utility_view', initial);
    }
  }

  function load() {
    Promise.allSettled([
      fetch('/data/traffic-surface.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/data/go-status.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/data/local-intelligence.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/data/explore-events.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(results => {
      render({
        surface: results[0].status === 'fulfilled' ? results[0].value : null,
        go: results[1].status === 'fulfilled' ? results[1].value : null,
        intel: results[2].status === 'fulfilled' ? results[2].value : null,
        explore: results[3].status === 'fulfilled' ? results[3].value : null
      });
    }).catch(() => { host.hidden = true; });
  }

  load();
  setInterval(load, 120000);
})();
