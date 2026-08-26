import { buildGoModel } from '/lib/go-times.js';
import { uniqueCameraCount } from '/lib/homepage-ranking.js';

(() => {
  const host = document.getElementById('localNow');
  if (!host) return;

  const VARIANT = 'icon-carousel';
  const MODES = ['driving', 'go', 'skyway', 'today'];
  const MODE_LABEL = {driving:'Driving', go:'GO transit', skyway:'Skyway', today:'Event'};
  const MODE_SHOW = {driving:'Show Driving', go:'Show GO', skyway:'Show Skyway', today:'Show Event'};
  const MODE_CAT = {driving:'TRAFFIC', go:'GO', skyway:'SKYWAY', today:'EVENT'};
  const SWIPE_PX = 36;
  const AUTO_MS = 7000;

  window.liveUtilityVariant = VARIANT;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const torontoDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(value ? new Date(value) : new Date());
  const goTripUrl = destination => `https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(torontoDay())}&transfers=true`;
  const torontoHour = (value) => Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', hour:'numeric', hourCycle:'h23'}).format(value ? new Date(value) : new Date()));
  const torontoMinute = (value) => Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', minute:'2-digit'}).format(value ? new Date(value) : new Date()));
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let selectedMode = null;
  let viewed = false;
  let lastModels = null;
  let lastPayload = null;
  let userTouched = false;
  let autoTimer = 0;
  let rotatedOnce = false;

  function track(name, mode) {
    const detail = {event:name, liveUtilityVariant:VARIANT, mode:mode || selectedMode || 'driving'};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(detail);
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(name, {detail})); } catch (_) {}
  }

  function noteInteraction() {
    userTouched = true;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = 0;
    }
  }

  function goModel(data) {
    return buildGoModel(data);
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

  function daysBetween(fromYmd, toYmd) {
    const [fy, fm, fd] = fromYmd.split('-').map(Number);
    const [ty, tm, td] = toYmd.split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
  }

  function relativeDay(start) {
    const day = torontoDay(start);
    const today = torontoDay();
    if (day === today) return torontoHour(start) >= 17 ? 'Tonight' : 'Today';
    if (day === shiftDay(today, 1)) return 'Tomorrow';
    const ahead = daysBetween(today, day);
    const weekday = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', weekday:'long'}).format(new Date(start));
    if (ahead >= 0 && ahead <= 6 && (weekday === 'Saturday' || weekday === 'Sunday')) return 'This weekend';
    if (ahead >= 0 && ahead <= 6) return weekday;
    return prettyDate(start);
  }

  function eventHook(title) {
    let text = String(title || '').trim();
    text = text.replace(/^Watch\s+/i, '');
    text = text.replace(/^Burlington(?:'s|’s)\s+/i, '');
    text = text.replace(/\s+(today|tonight|tomorrow)\.?$/i, '');
    if (!text) return 'Burlington event';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function eventHref(event) {
    const url = String(event?.url || '');
    if (url.startsWith('/')) return url;
    if (event?.id) return `/explore/#event-${encodeURIComponent(event.id)}`;
    return '/explore/';
  }

  function eventQuality(event) {
    const title = String(event.title || '');
    if (/^(meeting|notice|update)$/i.test(title)) return 0;
    if (/farmers market|ribfest|festival|election|voting|closure|eclipse|advance/i.test(title)) return 5;
    if (event.scope === 'Burlington' || event.category) return 3;
    return 1;
  }

  function nextEvent(data) {
    const now = Date.now();
    const hour = torontoHour();
    const events = (Array.isArray(data?.events) ? data.events : [])
      .filter(item => Date.parse(item.end || item.start) > now)
      .filter(item => eventQuality(item) >= 3)
      .sort((a, b) => {
        const quality = eventQuality(b) - eventQuality(a);
        return quality || Date.parse(a.start) - Date.parse(b.start);
      });
    const preferTomorrow = hour >= 20;
    const todayStamp = torontoDay();
    const tomorrowStamp = shiftDay(todayStamp, 1);
    const picked = events.find(item => preferTomorrow ? torontoDay(item.start) === tomorrowStamp : torontoDay(item.start) === todayStamp)
      || events[0];
    if (!picked) return null;
    return eventModel(picked);
  }

  function eventModel(picked) {
    const start = picked.start ? new Date(picked.start) : null;
    const hours = start && Number.isFinite(start.getTime()) ? clockLabel(start) : '';
    return {
      title: eventHook(picked.cardTitle || picked.title || 'Burlington event'),
      relative: start ? relativeDay(start) : '',
      dateLabel: start ? prettyDate(start) : (picked.dateLabel || ''),
      hours,
      url: eventHref(picked)
    };
  }

  function qaEventOverride() {
    const qa = new URLSearchParams(location.search).get('qa') || '';
    if (!qa.startsWith('event-')) return null;
    const today = torontoDay();
    const at = (ymd, hour, minute = 0) => `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`;
    const weekdayNum = ymd => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    };
    let saturday = today;
    for (let i = 0; i < 8; i += 1) {
      const day = shiftDay(today, i);
      if (weekdayNum(day) === 6 && day !== today && day !== shiftDay(today, 1)) {
        saturday = day;
        break;
      }
    }
    if (qa === 'event-today') {
      return eventModel({title:'Burlington Farmers Market', start: at(today, 10), url:'/events/burlington-farmers-market/'});
    }
    if (qa === 'event-tonight') {
      return eventModel({title:'Outdoor movie night', start: at(today, 20), url:'/explore/'});
    }
    if (qa === 'event-tomorrow') {
      return eventModel({
        title:'Partial lunar eclipse',
        start: at(shiftDay(today, 1), 22, 33),
        id:'partial-lunar-eclipse-2026'
      });
    }
    if (qa === 'event-weekend') {
      return eventModel({title:'Winona Peach Festival', start: at(saturday, 17), url:'/explore/#event-winona-peach-festival-2026'});
    }
    return null;
  }

  function shortPlace(value) {
    return String(value || '')
      .replace(/\s+(Drive|Rd|Road|Avenue|Ave|Street|St|Boulevard|Blvd|Line)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function commuteDestination() {
    const hour = torontoHour();
    if (hour < 11) return 'Toronto';
    if (hour < 15) return 'Oakville';
    if (hour < 19) return 'Hamilton';
    return 'Niagara';
  }

  function destinationFrom(item) {
    const hay = `${item.direction || ''} ${item.title || ''} ${item.impact || ''} ${item.context || ''}`;
    if (/niagara|fort erie/i.test(hay)) return 'Niagara';
    if (/hamilton/i.test(hay) && !/toronto/i.test(hay)) return 'Hamilton';
    if (/stoney creek/i.test(hay)) return 'Stoney Creek';
    if (/oakville or toronto|toronto/i.test(hay)) return 'Toronto';
    if (/oakville/i.test(hay)) return 'Oakville';
    return commuteDestination();
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

  function routeIdFor(dest) {
    const value = String(dest || '').toLowerCase();
    if (value.includes('oakville')) return 'oakville';
    if (value.includes('stoney')) return 'stoney-creek';
    if (value.includes('niagara')) return 'niagara-falls';
    if (value.includes('hamilton')) return 'hamilton';
    return 'toronto';
  }

  function looksLabel(value) {
    const looks = String(value || '').toLowerCase();
    if (!looks || looks === 'unknown' || looks === 'check cameras') return '';
    if (looks === 'heavy') return 'Heavy';
    if (looks === 'moderate' || looks === 'slow') return 'Moderate';
    if (looks === 'clear' || looks === 'light') return 'Light traffic';
    return '';
  }

  function isRamp(item) {
    return item?.facility === 'on-ramp' || item?.facility === 'off-ramp' || /on-ramp|off-ramp|\bramp\b/i.test(`${item?.title || ''} ${item?.rawHeadline || ''}`);
  }

  function isMainlineClosure(item) {
    const text = `${item?.title || ''} ${item?.rawHeadline || ''}`;
    if (isRamp(item)) return false;
    if (/construction|nightly/i.test(text) && !/all lanes closed|completely closed|fully closed/i.test(text)) return false;
    return item?.type === 'closure' && /all lanes closed|completely closed|fully closed|closed in both directions/i.test(text);
  }

  function drivingModel(surface, intel) {
    const incidents = Array.isArray(surface?.incidents) ? surface.incidents : [];
    const ready = surface?.homepageTraffic;
    const local = incidents.find(item => /burlington/i.test(item.municipality || '') && (item.type === 'closure' || item.type === 'collision') && !isRamp(item))
      || incidents.find(item => (item.type === 'collision') || (item.type === 'closure' && !isRamp(item)));
    const destHint = commuteDestination();
    const commute = surface?.routes?.[routeIdFor(destHint)] || surface?.routes?.toronto || surface?.routes?.hamilton || {};
    const source = local || (ready?.title ? {
      title: ready.title,
      context: ready.context || '',
      impact: ready.impact || '',
      direction: '',
      municipality: /burlington/i.test(ready.context || '') ? 'Burlington' : '',
      nearestRoad: '',
      type: /clos/i.test(ready.title) ? 'closure' : (/collision|crash/i.test(ready.title) ? 'collision' : ''),
      roadway: '',
      rawHeadline: '',
      facility: /ramp/i.test(ready.title) ? 'on-ramp' : ''
    } : null);

    if (source || ready?.title) {
      const item = source || {};
      const dest = destinationFrom({...item, impact: ready?.impact || item.impact, title: ready?.title || item.title});
      const road = roadwayFrom({...item, title: ready?.title || item.title});
      const place = shortPlace(item.nearestRoad || (ready?.context || '').split('·').pop() || '');
      const type = String(item.type || (/clos/i.test(ready?.title || '') ? 'closure' : (/collision|crash/i.test(ready?.title || '') ? 'collision' : '')));
      const minutes = delayMinutesFrom(item) || delayMinutesFrom(ready || {});
      const laneClosed = /lane closed|lanes closed|all lanes/i.test(`${item.rawHeadline || ''} ${item.title || ''} ${ready?.title || ''}`);
      const intensity = type === 'closure' || laneClosed ? 'Heavy' : (type === 'collision' ? 'Heavy' : looksLabel(commute?.status?.looks || commute?.status?.level));
      const eventLabel = type === 'closure' ? (isRamp(item) ? 'Ramp closed' : 'Closure') : (type === 'collision' ? 'Collision' : 'Incident');
      const placeLine = place
        ? (type === 'collision' || type === 'closure' ? `${eventLabel} near ${place}` : `${intensity || 'Watch'} near ${place}`)
        : (ready?.context || item.context || '');
      const metric = minutes
        ? `+${minutes} min`
        : (type === 'closure' && isRamp(item) ? 'Ramp closed' : (type === 'collision' || (type === 'closure' && !isRamp(item)) ? 'Delay likely' : (intensity || 'Clear')));
      const critical = isMainlineClosure(item) && /qew|403|skyway/i.test(`${item.roadway || ''} ${ready?.title || item.title || ''}`);
      return {
        alert: Boolean(ready?.alert || type),
        major: Boolean((type === 'collision' || (type === 'closure' && !isRamp(item))) && /burlington|qew|403|skyway/i.test(`${item.municipality || ''} ${item.roadway || ''} ${ready?.title || item.title || ''}`)),
        critical,
        title: `${road} → ${dest}`,
        metric,
        detail: intensity && place && !minutes ? `${intensity} near ${place}` : placeLine,
        extra: minutes && place ? `${eventLabel} near ${place}` : '',
        url: `/traffic/?destination=${routeIdFor(dest)}`
      };
    }

    const top = intel?.topSignal;
    if (top && Number(top.score) >= 90 && /collision|closure|closed/i.test(`${top.headline || ''}`)) {
      return {
        alert:true, major:true, critical:false, title:top.headline, metric:'Delay likely',
        detail:top.location || '', extra:'', url:top.url || '/traffic/'
      };
    }

    const dest = commuteDestination();
    const looks = looksLabel(commute?.status?.looks);
    if (looks) {
      return {
        alert:false, major:false, critical:false, title:`QEW → ${dest}`,
        metric: looks,
        detail: looks === 'Light traffic' ? 'No major delay' : 'Live conditions',
        extra:'', url:`/traffic/?destination=${routeIdFor(dest)}`
      };
    }

    return {
      alert:false, major:false, critical:false, title:`QEW → ${dest}`,
      metric:'Clear', detail:'No major delay', extra:'', url:`/traffic/?destination=${routeIdFor(dest)}`
    };
  }

  function skywayModel(surface) {
    const skyway = surface?.skyway || {};
    const incidents = (Array.isArray(surface?.incidents) ? surface.incidents : []).filter(item => item.affectsSkyway);
    const major = incidents.find(item => item.type === 'collision' || (item.type === 'closure' && !isRamp(item)));
    const watch = incidents.find(item => item.type === 'construction');
    const raw = String(skyway.value || '').trim();
    const looks = looksLabel(raw);

    if (major) {
      const niagara = /fort erie|niagara|hamilton/i.test(`${major.direction || ''} ${major.title || ''}`);
      const dest = niagara ? 'Niagara' : 'Toronto';
      const minutes = delayMinutesFrom(major);
      return {
        alert:true,
        major:true,
        critical: major.type === 'closure',
        title: `Skyway → ${dest}`,
        metric: minutes ? `+${minutes} min` : (major.type === 'closure' ? 'Closed' : 'Delay likely'),
        detail: shortPlace(major.nearestRoad) ? `${major.type === 'closure' ? 'Closure' : 'Collision'} near ${shortPlace(major.nearestRoad)}` : (major.title || ''),
        url:`/traffic/?destination=${niagara ? 'hamilton' : 'toronto'}&focus=skyway`
      };
    }

    if (looks) {
      return {
        alert: looks === 'Heavy', major: looks === 'Heavy', critical:false,
        title:'Skyway → Toronto',
        metric: looks,
        detail: looks === 'Heavy' ? 'Slow approaching the bridge' : '',
        url:'/traffic/?destination=toronto&focus=skyway'
      };
    }

    if (watch) {
      return {
        alert:false, major:false, critical:false,
        title:'Skyway → Niagara',
        metric:'Watch',
        detail: shortPlace(watch.nearestRoad) ? `Construction near ${shortPlace(watch.nearestRoad)}` : 'Construction on a monitored approach',
        url:'/traffic/?destination=hamilton&focus=skyway'
      };
    }

    const named = [];
    Object.values(surface?.routes || {}).forEach(route => {
      (route?.cameras || []).forEach(cam => {
        if (/skyway/i.test(`${cam.cameraName || ''} ${cam.viewName || ''}`)) named.push(cam);
      });
    });
    const cameras = uniqueCameraCount(named.length ? named : (surface?.routes?.toronto?.cameras || []));
    return {
      alert:false, major:false, critical:false,
      title:'Skyway → Toronto',
      metric: cameras ? `${cameras} camera${cameras === 1 ? '' : 's'} available` : 'Check traffic',
      detail:'',
      url:'/traffic/?destination=toronto&focus=skyway',
      lowConfidence:true
    };
  }

  function chooseDefault(models) {
    if (models.go.critical) return 'go';
    if (models.skyway.critical) return 'skyway';
    if (models.driving.critical) return 'driving';
    return 'driving';
  }

  const icon = (name, path) => `<span class="now-icon now-icon-${name}" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
  const icons = {
    driving: icon('traffic', '<path d="M5 16h14l-1.2-6.2A2 2 0 0 0 15.9 8H8.1a2 2 0 0 0-1.9 1.8L5 16Z"/><path d="M7 16v2M17 16v2M8 11h8"/>'),
    go: icon('go', '<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M9 8h6M9 12h6M10 18h4"/>'),
    skyway: icon('skyway', '<path d="M3 16h18M5 16c2-6 5-9 7-9s5 3 7 9"/><path d="M8 16v-3M16 16v-3"/>'),
    today: icon('event', '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>')
  };

  function nextButton() {
    return `<button type="button" class="now-next" data-now-next aria-label="Show next local update"><span class="now-next-disc" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></button>`;
  }

  function wrapCard(inner) {
    return `<div class="now-card-shell">${inner}${nextButton()}</div>`;
  }

  function compactCard(mode, model) {
    if (mode === 'today' && !model) {
      return wrapCard(`<a class="now-card now-card-today now-card-event" href="/explore/" data-utility-card="today">${icons.today}<span class="now-card-copy"><small class="now-card-cat">EVENT</small><strong>What’s on in Burlington</strong></span></a>`);
    }
    const title = mode === 'today' ? model.title : model.title || model.headline;
    const metric = mode === 'today' ? (model.relative || '') : (mode === 'go' ? (model.time || '') : (model.metric || ''));
    const detail = mode === 'go'
      ? [model.status, model.cause || (model.unavailable ? model.detail : '')].filter(Boolean).join(' · ')
      : (mode === 'today' ? (model.hours || '') : (model.extra || model.detail || ''));
    const href = model.url || '#';
    const extra = mode === 'go' && model.url && /gotransit\.com/.test(model.url) ? ' target="_blank" rel="noopener"' : '';
    return wrapCard(`<a class="now-card now-card-${mode}${mode === 'today' ? ' now-card-event' : ''}${model.alert ? ' is-alert' : ''}" href="${esc(href)}" data-utility-card="${mode}"${extra}>
      ${icons[mode] || ''}
      <span class="now-card-copy">
        <small class="now-card-cat">${MODE_CAT[mode] || ''}</small>
        <strong>${esc(title)}</strong>
        ${detail ? `<em>${esc(detail)}</em>` : ''}
      </span>
      ${metric ? `<b class="now-card-metric">${esc(metric)}</b>` : ''}
    </a>`);
  }

  function cardFor(mode, models) {
    if (mode === 'go') return compactCard('go', models.go);
    if (mode === 'skyway') return compactCard('skyway', models.skyway);
    if (mode === 'today') return compactCard('today', models.today);
    return compactCard('driving', models.driving);
  }

  function headerSlot() {
    return document.getElementById('headerLive');
  }

  function useHeaderCard() {
    return Boolean(headerSlot() && matchMedia('(max-width:720px)').matches);
  }

  function paintCard(mode) {
    const html = cardFor(mode, lastModels);
    if (useHeaderCard()) {
      const slot = headerSlot();
      slot.hidden = false;
      slot.innerHTML = html;
      bindCard(slot);
      return;
    }
    const slot = headerSlot();
    if (slot) {
      slot.hidden = true;
      slot.innerHTML = '';
    }
    const panel = host.querySelector('[role="tabpanel"]');
    if (panel) {
      panel.id = `nowPanel-${mode}`;
      panel.setAttribute('aria-labelledby', `nowTab-${mode}`);
      panel.innerHTML = html;
      bindCard(panel);
    }
  }

  function applyMode(mode, focusTab) {
    if (!lastModels || !MODES.includes(mode)) return;
    selectedMode = mode;
    const tabs = [...host.querySelectorAll('[role="tab"], [data-now-dot]')];
    tabs.forEach(tab => {
      const on = tab.dataset.mode === mode;
      if (tab.getAttribute('role') === 'tab') {
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
      }
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && focusTab && tab.getAttribute('role') === 'tab') tab.focus();
    });
    paintCard(mode);
  }

  function stepMode(delta) {
    const index = MODES.indexOf(selectedMode);
    const next = MODES[(index + delta + MODES.length) % MODES.length];
    if (next !== selectedMode) {
      applyMode(next);
      track('live_utility_mode_change', next);
    }
  }

  function bindCard(panel) {
    const card = panel.querySelector('[data-utility-card]');
    const nextBtn = panel.querySelector('[data-now-next]');
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let swiping = false;
    let tracking = false;

    nextBtn?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      noteInteraction();
      stepMode(1);
    });
    nextBtn?.addEventListener('pointerdown', event => event.stopPropagation());

    const start = event => {
      if (event.target.closest('[data-now-next]')) return;
      const point = event.touches ? event.touches[0] : event;
      startX = point.clientX;
      startY = point.clientY;
      swiping = false;
      tracking = true;
    };
    const move = event => {
      if (!tracking) return;
      const point = event.touches ? event.touches[0] : event;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        swiping = true;
        if (event.cancelable) event.preventDefault();
      }
    };
    const end = event => {
      if (!tracking) return;
      tracking = false;
      const point = event.changedTouches ? event.changedTouches[0] : event;
      const dx = point.clientX - startX;
      if (swiping && Math.abs(dx) >= SWIPE_PX) {
        noteInteraction();
        stepMode(dx < 0 ? 1 : -1);
      }
    };

    card.addEventListener('click', event => {
      if (swiping) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      track('live_utility_card_click', selectedMode);
    });
    card.addEventListener('pointerdown', start);
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', () => { tracking = false; });
    card.addEventListener('touchstart', start, {passive:true});
    card.addEventListener('touchmove', move, {passive:false});
    card.addEventListener('touchend', end);
  }

  function bindTabs() {
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        noteInteraction();
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
        noteInteraction();
        const mode = tabs[next].dataset.mode;
        if (mode !== selectedMode) track('live_utility_mode_change', mode);
        applyMode(mode, true);
      });
    });
  }

  function startAutoAdvance() {
    if (reduceMotion() || userTouched || rotatedOnce) return;
    autoTimer = window.setTimeout(() => {
      if (userTouched || rotatedOnce) return;
      rotatedOnce = true;
      stepMode(1);
    }, AUTO_MS);
  }

  function chromeMarkup(initial, includePanel) {
    const indicators = `
      <div class="now-dots" role="tablist" aria-label="Live local update">
        ${MODES.map(mode => `<button type="button" class="now-dot-btn now-tab-${mode}${mode === initial ? ' is-active' : ''}" role="tab" id="nowTab-${mode}" data-now-dot data-mode="${mode}" aria-label="${MODE_SHOW[mode]}" aria-selected="${mode === initial}" aria-current="${mode === initial ? 'true' : 'false'}" tabindex="${mode === initial ? 0 : -1}"><span class="now-pager-dot" aria-hidden="true"></span></button>`).join('')}
      </div>`;
    if (!includePanel) return indicators;
    return `
      <div class="now-panel" role="tabpanel" id="nowPanel-${initial}" aria-labelledby="nowTab-${initial}">
        ${cardFor(initial, lastModels)}
      </div>
      ${indicators}`;
  }

  function render(payload) {
    const models = {
      driving: drivingModel(payload.surface, payload.intel),
      go: goModel(payload.go),
      skyway: skywayModel(payload.surface),
      today: qaEventOverride() || nextEvent(payload.explore)
    };
    lastModels = models;
    lastPayload = payload;
    const initial = selectedMode || chooseDefault(models);
    selectedMode = initial;

    host.dataset.liveUtilityVariant = VARIANT;
    host.classList.toggle('is-header-card', useHeaderCard());
    host.innerHTML = chromeMarkup(initial, !useHeaderCard());
    paintCard(initial);
    bindTabs();
    if (!useHeaderCard()) bindCard(host.querySelector('[role="tabpanel"]'));
    if (!viewed) {
      viewed = true;
      track('live_utility_view', initial);
      startAutoAdvance();
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
  const viewport = matchMedia('(max-width:720px)');
  viewport.addEventListener('change', () => {
    if (lastPayload) render(lastPayload);
  });
})();
