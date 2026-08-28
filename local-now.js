import { buildGoModel } from '/lib/go-times.js';
import { uniqueCameraCount } from '/lib/homepage-ranking.js';

(() => {
  const host = document.getElementById('localNow');
  if (!host) return;

  const VARIANT = 'icon-carousel';
  const MODES = ['driving', 'go', 'skyway', 'today'];
  const MODE_SHOW = {
    driving: 'Show Driving',
    go: 'Show GO',
    skyway: 'Show Skyway',
    today: 'Show Event'
  };
  const MODE_CAT = {
    driving: 'TRAFFIC',
    go: 'GO',
    skyway: 'SKYWAY',
    today: 'EVENT'
  };
  const SWIPE_PX = 36;
  const TRAFFIC_ROTATE_MS = 9000;
  const EVENING_START_HOUR = 17;
  const LATE_NIGHT_START_HOUR = 21;
  const NIGHT_END_HOUR = 2;
  const MANUAL_MODE_PAUSE_MS = 90000;

  window.liveUtilityVariant = VARIANT;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  let selectedMode = null;
  let lastModels = null;
  let viewed = false;
  let trafficIndex = 0;
  let trafficTimer = null;
  let modeTimer = null;
  let modePausedUntil = 0;

  const icon = (name, path) => `<span class="now-icon now-icon-${name}" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
  const icons = {
    driving: icon('traffic', '<path d="M5 16h14l-1.2-6.2A2 2 0 0 0 15.9 8H8.1a2 2 0 0 0-1.9 1.8L5 16Z"/><path d="M7 16v2M17 16v2M8 11h8"/>'),
    go: icon('go', '<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M9 8h6M9 12h6M10 18h4"/>'),
    skyway: icon('skyway', '<path d="M3 16h18M5 16c2-6 5-9 7-9s5 3 7 9"/><path d="M8 16v-3M16 16v-3"/>'),
    today: icon('event', '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>')
  };

  const pagerDots = () => `<span class="now-card-dots" role="tablist" aria-label="Live local update">${MODES.map(mode => `<button type="button" class="now-card-dot-btn${mode === selectedMode ? ' is-active' : ''}" role="tab" data-now-dot data-mode="${mode}" aria-label="${MODE_SHOW[mode]}" aria-selected="${mode === selectedMode}" aria-current="${mode === selectedMode ? 'true' : 'false'}"><span aria-hidden="true"></span></button>`).join('')}</span>`;
  const nextButton = () => '<button class="now-next-button" type="button" data-now-next aria-label="Show next live update"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>';

  function track(name, mode) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: name,
        liveUtilityVariant: VARIANT,
        mode: mode || selectedMode || 'driving'
      });
    } catch (_) {}
  }

  function torontoDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function torontoHour(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return 12;
    const hour = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(date);
    return Number(hour);
  }

  function rotationWindow() {
    const hour = torontoHour();
    if (hour >= LATE_NIGHT_START_HOUR || hour < NIGHT_END_HOUR) return 'late';
    if (hour >= EVENING_START_HOUR) return 'evening';
    return 'day';
  }

  function isTonightEvent(item, nowDate = new Date()) {
    if (!item?.start) return false;
    if (torontoDateKey(item.start) !== torontoDateKey(nowDate)) return false;
    const startHour = torontoHour(item.start);
    const endHour = item.end && torontoDateKey(item.end) === torontoDateKey(nowDate)
      ? torontoHour(item.end)
      : 23;
    const startMs = new Date(item.start).getTime();
    const endMs = item.end ? new Date(item.end).getTime() : startMs + (3 * 60 * 60 * 1000);
    const activeNow = startMs <= nowDate.getTime() && endMs >= nowDate.getTime();
    return startHour >= 16 || endHour >= 19 || (torontoHour(nowDate) >= EVENING_START_HOUR && activeNow);
  }

  function routeModel(route, key) {
    if (!route) return null;
    const west = key === 'hamilton';
    const cameras = uniqueCameraCount(route?.cameras || []);
    const status = route?.status || {};
    const rawDetail = status.summary || status.detail || '';
    const estimateMissing = /no current (camera|travel|route) estimate|estimate unavailable|unavailable/i.test(rawDetail);
    const metric = status.looks || (cameras ? `${cameras} cameras` : 'Live');
    const detail = estimateMissing
      ? (cameras ? 'Open live QEW cameras' : 'Check live incidents and road status')
      : (rawDetail || (cameras ? 'Open live QEW cameras' : 'Live incidents and road status'));
    return {
      title: west ? 'QEW → Hamilton' : 'QEW → Toronto',
      metric,
      detail,
      url: `/traffic/?destination=${west ? 'hamilton' : 'toronto'}`
    };
  }

  function drivingModels(surface) {
    const rows = [];
    const incident = (surface?.incidents || []).find(item => /burlington|oakville|halton|qew|403|skyway/i.test(`${item.municipality || ''} ${item.roadway || ''} ${item.title || ''}`));
    if (incident && /closed|collision|crash|blocked|closure|incident/i.test(incident.title || '')) {
      rows.push({
        title: `${incident.roadway || 'QEW'} traffic`,
        metric: /closed/i.test(incident.title || '') ? 'Closed' : 'Watch',
        detail: incident.title || '',
        url: '/traffic/',
        alert: true
      });
    }
    const east = routeModel(surface?.routes?.toronto, 'toronto');
    const west = routeModel(surface?.routes?.hamilton, 'hamilton');
    if (east) rows.push(east);
    if (west) rows.push(west);
    return rows.length ? rows : [{
      title: 'QEW → Toronto',
      metric: 'Traffic',
      detail: 'Check live incidents and QEW cameras',
      url: '/traffic/?destination=toronto'
    }];
  }

  function goModel(data) {
    const model = buildGoModel(data || {}, new Date());
    const unavailable = Boolean(model?.unavailable);
    return {
      title: model?.headline || 'Burlington → Union',
      time: model?.time || '',
      status: unavailable ? 'Timetable' : (model?.status || ''),
      detail: unavailable ? 'Open the official GO schedule' : (model?.detail || ''),
      url: model?.url || '/go/burlington-to-union/',
      alert: Boolean(model?.alert)
    };
  }

  function skywayModel(surface) {
    const route = surface?.routes?.hamilton || surface?.routes?.toronto;
    const cameras = uniqueCameraCount(route?.cameras || []);
    return {
      title: 'Burlington Skyway',
      metric: cameras ? `${cameras} cameras` : 'Live',
      detail: cameras ? 'Open live bridge cameras' : 'Check current bridge traffic',
      url: '/traffic/?focus=skyway'
    };
  }

  function todayModel(explore) {
    const nowDate = new Date();
    const now = nowDate.getTime();
    const items = (explore?.items || explore?.events || [])
      .filter(item => {
        const start = new Date(item?.start || 0).getTime();
        const end = item?.end ? new Date(item.end).getTime() : start + (3 * 60 * 60 * 1000);
        return Number.isFinite(start) && Number.isFinite(end) && end >= now;
      })
      .sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0));
    const item = items.find(candidate => isTonightEvent(candidate, nowDate)) || items[0];
    if (!item) return null;
    const tonight = isTonightEvent(item, nowDate);
    return {
      title: item.title || item.name,
      relative: tonight ? 'Tonight' : (item.dateLabel || item.relative || ''),
      hours: item.venue || item.hours || '',
      url: item.url || (item.id ? `/explore/?event=${encodeURIComponent(item.id)}` : '/explore/'),
      isTonight: tonight
    };
  }

  function compactCard(mode, model) {
    if (mode === 'today' && !model) model = { title: 'What’s on in Burlington', url: '/explore/' };
    const title = model.title || model.headline;
    const metric = mode === 'go' ? (model.time || model.status || '') : (mode === 'today' ? '' : (model.metric || ''));
    const detail = mode === 'go'
      ? [model.time ? model.status : '', model.detail].filter(Boolean).join(' · ')
      : (mode === 'today'
          ? [model.relative, model.hours].filter(Boolean).join(' · ')
          : (model.extra || model.detail || ''));

    return `<div class="now-card-shell"><a class="now-card now-card-${mode}${model.alert ? ' is-alert' : ''}" href="${esc(model.url || '#')}" data-utility-card="${mode}">${icons[mode]}<span class="now-card-copy"><small class="now-card-cat">${MODE_CAT[mode]}</small><strong>${esc(title)}</strong>${detail ? `<em>${esc(detail)}</em>` : ''}</span>${metric ? `<b class="now-card-metric">${esc(metric)}</b>` : ''}</a>${pagerDots()}${nextButton()}</div>`;
  }

  function modelFor(mode) {
    if (mode === 'driving') {
      const rows = lastModels.driving || [];
      return rows[trafficIndex % rows.length];
    }
    return lastModels[mode];
  }

  function panel() {
    return document.querySelector('#localNow [role="tabpanel"], #headerLive [role="tabpanel"]');
  }

  function cardFor(mode) {
    return compactCard(mode, modelFor(mode));
  }

  function syncDots(mode) {
    document.querySelectorAll('#localNow [data-now-dot], #headerLive [data-now-dot]').forEach(tab => {
      const on = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }

  function pauseModeRotation() {
    modePausedUntil = Date.now() + MANUAL_MODE_PAUSE_MS;
  }

  function rotationConfig() {
    const windowName = rotationWindow();
    if (windowName === 'day') return null;
    const hasTonight = Boolean(lastModels?.today?.isTonight);
    if (windowName === 'late') {
      return {
        sequence: hasTonight ? ['today', 'driving', 'skyway'] : ['driving', 'skyway', 'today'],
        dwell: hasTonight
          ? { today: 52000, driving: 20000, skyway: 20000 }
          : { today: 28000, driving: 24000, skyway: 24000 }
      };
    }
    return {
      sequence: hasTonight ? ['today', 'driving', 'go', 'skyway'] : ['driving', 'go', 'skyway', 'today'],
      dwell: hasTonight
        ? { today: 40000, driving: 22000, go: 22000, skyway: 22000 }
        : { today: 26000, driving: 26000, go: 26000, skyway: 26000 }
    };
  }

  function restartModeRotation() {
    clearTimeout(modeTimer);
    modeTimer = null;
    const config = rotationConfig();
    if (!config || !lastModels) return;
    if (Date.now() < modePausedUntil) {
      modeTimer = setTimeout(restartModeRotation, Math.max(1000, modePausedUntil - Date.now()));
      return;
    }
    const sequence = config.sequence.filter(mode => mode !== 'today' || Boolean(lastModels.today));
    if (sequence.length < 2) return;
    const currentIndex = sequence.indexOf(selectedMode);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 0;
    const dwell = config.dwell[selectedMode] || 26000;
    modeTimer = setTimeout(() => applyMode(sequence[nextIndex], { auto: true }), dwell);
  }

  function bindDots(root) {
    root?.querySelectorAll('[data-now-dot]').forEach(tab => tab.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      pauseModeRotation();
      applyMode(tab.dataset.mode);
      track('live_utility_mode_change', tab.dataset.mode);
    }));
  }

  function bindNext(root) {
    root?.querySelectorAll('[data-now-next]').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      pauseModeRotation();
      stepMode(1);
    }));
  }

  function bindInteractive(root) {
    bindCard(root);
    bindDots(root);
    bindNext(root);
  }

  function applyMode(mode, options = {}) {
    if (!lastModels || !MODES.includes(mode)) return;
    selectedMode = mode;
    const target = panel();
    if (target) {
      target.innerHTML = cardFor(mode);
      bindInteractive(target);
    }
    syncDots(mode);
    restartTrafficRotation();
    restartModeRotation();
    if (options.auto) track('live_utility_auto_rotate', mode);
  }

  function stepMode(delta) {
    const index = MODES.indexOf(selectedMode);
    applyMode(MODES[(index + delta + MODES.length) % MODES.length]);
    track('live_utility_mode_change', selectedMode);
  }

  function bindCard(target) {
    const card = target?.querySelector('[data-utility-card]');
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let swiping = false;

    card.addEventListener('touchstart', event => {
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      swiping = false;
    }, { passive: true });

    card.addEventListener('touchmove', event => {
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        swiping = true;
        if (event.cancelable) event.preventDefault();
      }
    }, { passive: false });

    card.addEventListener('touchend', event => {
      const dx = event.changedTouches[0].clientX - startX;
      if (swiping && Math.abs(dx) >= SWIPE_PX) {
        pauseModeRotation();
        stepMode(dx < 0 ? 1 : -1);
      }
    });

    card.addEventListener('click', event => {
      if (swiping) {
        event.preventDefault();
        return;
      }
      track('live_utility_card_click', selectedMode);
    });
  }

  function restartTrafficRotation() {
    clearInterval(trafficTimer);
    trafficTimer = null;
    if (selectedMode !== 'driving' || !lastModels?.driving || lastModels.driving.length < 2) return;
    trafficTimer = setInterval(() => {
      if (selectedMode !== 'driving') return;
      trafficIndex = (trafficIndex + 1) % lastModels.driving.length;
      const target = panel();
      if (target) {
        target.innerHTML = cardFor('driving');
        bindInteractive(target);
      }
    }, TRAFFIC_ROTATE_MS);
  }

  function preferredInitialMode() {
    const windowName = rotationWindow();
    if ((windowName === 'evening' || windowName === 'late') && lastModels?.today?.isTonight) return 'today';
    return 'driving';
  }

  function render(payload) {
    lastModels = {
      driving: drivingModels(payload.surface),
      go: goModel(payload.go),
      skyway: skywayModel(payload.surface),
      today: todayModel(payload.explore)
    };
    selectedMode = selectedMode || preferredInitialMode();
    host.innerHTML = `<div class="now-panel" role="tabpanel">${cardFor(selectedMode)}</div><div class="now-dots" role="tablist" aria-label="Live local update">${MODES.map(mode => `<button type="button" class="now-dot-btn${mode === selectedMode ? ' is-active' : ''}" role="tab" data-now-dot data-mode="${mode}" aria-label="${MODE_SHOW[mode]}" aria-selected="${mode === selectedMode}" aria-current="${mode === selectedMode ? 'true' : 'false'}"><span class="now-pager-dot" aria-hidden="true"></span></button>`).join('')}</div>`;
    bindInteractive(host);
    restartTrafficRotation();
    restartModeRotation();
    if (!viewed) {
      viewed = true;
      track('live_utility_view', selectedMode);
    }
  }

  async function fetchJson(url, timeoutMs = 2200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    const [surface, go, intel, explore] = await Promise.all([
      fetchJson('/data/traffic-surface.json'),
      fetchJson('/data/go-status.json'),
      fetchJson('/data/local-intelligence.json'),
      fetchJson('/data/explore-events.json')
    ]);
    // The page already contains a static traffic fallback. Only replace it
    // when at least one live source answered in time.
    if (surface || go || intel || explore) render({ surface, go, intel, explore });
  }

  load();
  setInterval(load, 120000);
})();