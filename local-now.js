(() => {
  const host = document.getElementById('localNow');
  if (!host) return;
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const torontoDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(value ? new Date(value) : new Date());
  const shortDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', month:'short', day:'numeric'}).format(new Date(value));
  const goTripUrl = destination => `https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(torontoDay())}&transfers=true`;
  const torontoHour = () => Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', hour:'numeric', hourCycle:'h23'}).format(new Date()));

  function timeOnly(value) {
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour24 = Number(match[1]) % 24;
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    const hour = hour24 % 12 || 12;
    return `${hour}:${match[2]} ${suffix}`;
  }

  function timeCompact(value) {
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour = Number(match[1]) % 24 % 12 || 12;
    return `${hour}:${match[2]}`;
  }

  function departureLabel(journey, compact) {
    const raw = journey.computedDeparture || journey.departure;
    const time = compact ? timeCompact(raw) : timeOnly(raw);
    if (!time) return '';
    const status = String(journey.departureStatus || '');
    if (journey.computedDeparture && /late|delay|delayed/i.test(status)) return compact ? `${time} delay` : `${time} delayed`;
    return time;
  }

  function routeJourneys(data, code, count) {
    const route = (Array.isArray(data?.routes) ? data.routes : []).find(item => String(item.destination?.stopCode || '').toUpperCase() === code);
    return (Array.isArray(route?.journeys) ? route.journeys : []).slice(0, count);
  }

  function goSummary(data) {
    const alert = Array.isArray(data?.alerts) && data.alerts[0];
    if (alert) return {alert:true, headline:alert.headline || 'Service alert', url:data.liveStatusUrl || 'https://www.gotransit.com/en/service-updates/service-updates'};
    const union = routeJourneys(data, 'UN', 3);
    const west = routeJourneys(data, 'WR', 3);
    const hour = torontoHour();
    const preferUnion = hour < 11 || hour >= 14;
    return {
      alert:false,
      primary:{code:'UN', name:'Union', url:goTripUrl('UN'), journeys:preferUnion ? union : west},
      secondary:{code:'WR', name:preferUnion ? 'West Harbour' : 'Union', url:goTripUrl(preferUnion ? 'WR' : 'UN'), journeys:preferUnion ? west : union},
      union, west
    };
  }

  function compactEventWhen(event) {
    if (!event?.start) return event?.dateLabel || '';
    const start = new Date(event.start);
    if (!Number.isFinite(start.getTime())) return event.dateLabel || '';
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', weekday:'short'}).format(start);
    const hourPart = date => {
      const hour = Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', hour:'numeric', hourCycle:'h23'}).format(date));
      const minute = Number(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', minute:'2-digit'}).format(date));
      const display = hour % 12 || 12;
      return minute ? `${display}:${String(minute).padStart(2, '0')}` : String(display);
    };
    const end = event.end ? new Date(event.end) : null;
    if (end && Number.isFinite(end.getTime())) return `${day} · ${hourPart(start)}–${hourPart(end)}`;
    return `${day} · ${hourPart(start)}`;
  }

  function nextEvent(data) {
    const now = Date.now();
    const events = (Array.isArray(data?.events) ? data.events : []).filter(item => Date.parse(item.end || item.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const event = events[0];
    if (!event) return null;
    const title = String(event.title || '').replace(/^Burlington(?:’s|'s)?\s+/i, '');
    return {
      title,
      fullTitle: event.title,
      dateLabel: event.dateLabel || shortDate(event.start),
      compactWhen: compactEventWhen(event),
      url: `/explore/#event-${encodeURIComponent(event.id || '')}`
    };
  }

  function compactTrafficTitle(title) {
    const text = String(title || '');
    const match = text.match(/\b(QEW|403|407|401)\b[\s\S]*?\b(collision|closure|closed)\b[\s\S]*?\bat\s+([^,.]+)/i);
    if (match) {
      const place = match[3].replace(/\s+(Drive|Rd|Road|Avenue|Ave|Street|St)\.?$/i, '').trim();
      const kind = /closed/i.test(match[2]) ? 'closure' : match[2].toLowerCase();
      return `${match[1]} ${kind} at ${place}`;
    }
    return text.replace(/Toronto-bound on-ramp /i, '').replace(/ on-ramp /i, ' ');
  }

  function compactImpact(item) {
    const impact = String(item.impact || '');
    const direction = item.direction || (/\b(Toronto-bound|Fort Erie-bound|Niagara-bound)\b/i.exec(`${item.title || ''} ${item.context || ''}`) || [])[1] || '';
    if (/Oakville or Toronto/i.test(impact)) return direction ? `${direction} delay possible` : 'May affect Oakville / Toronto trips';
    if (/Hamilton or Niagara/i.test(impact)) return 'May affect Hamilton / Niagara trips';
    if (!impact) return direction ? `${direction} · ${item.municipality || 'Burlington'}` : '';
    return impact.replace(/^Could affect trips from Burlington toward /i, 'May affect ').replace(/\.$/, '');
  }

  function trafficItem(surface, intel) {
    const ready = surface?.homepageTraffic;
    const incidents = Array.isArray(surface?.incidents) ? surface.incidents : [];
    const local = incidents.find(item => /burlington/i.test(item.municipality || '') && (item.type === 'closure' || item.type === 'collision')) || incidents.find(item => item.type === 'closure' || item.type === 'collision');
    const base = ready?.title ? {
      title: ready.title,
      context: ready.context || '',
      impact: ready.impact || '',
      url: ready.url || '/traffic/',
      alert: Boolean(ready.alert),
      direction: local?.direction || '',
      municipality: local?.municipality || ''
    } : local ? {
      title: local.title,
      context: [local.municipality, local.nearestRoad, local.updatedLabel].filter(Boolean).join(' · '),
      impact: local.impact || '',
      url: '/traffic/',
      alert: true,
      direction: local.direction || '',
      municipality: local.municipality || ''
    } : null;
    if (base) {
      return {
        ...base,
        shortTitle: compactTrafficTitle(base.title),
        shortImpact: compactImpact(base),
        meta: [base.direction, base.municipality || (base.context.split('·')[0] || '').trim()].filter(Boolean).join(' · ')
      };
    }
    const top = intel?.topSignal;
    if (top && Number(top.score) >= 90) {
      const hay = `${top.headline || ''} ${top.location || ''}`.toLowerCase();
      if (/burlington|skyway|qew|oakville|hamilton/.test(hay) && /collision|closure|closed/.test(hay)) {
        return {title:top.headline, shortTitle:compactTrafficTitle(top.headline), context:top.location || '', shortImpact:'', meta:top.location || '', url:top.url || '/traffic/', alert:true};
      }
    }
    return {title:'Check cameras', shortTitle:'View cameras', context:'Downtown Burlington routes', shortImpact:'', meta:'', url:'/traffic/', alert:false};
  }

  function skywayItem(surface) {
    const skyway = surface?.skyway;
    const raw = String(skyway?.value || '').trim();
    if (raw && !/check cameras/i.test(raw)) return {value:raw, compact:raw, alert:Boolean(skyway.alert), detail:skyway.detail || ''};
    return {value:'Check cameras', compact:'View cameras', alert:false, detail:skyway?.detail || ''};
  }

  const icon = (name, path) => `<span class="now-icon now-icon-${name}" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
  const icons = {
    traffic: icon('traffic', '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>'),
    weather: icon('weather', '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    skyway: icon('skyway', '<path d="M4 16h16M7 16V9l5-3 5 3v7"/><circle cx="12" cy="12" r="2"/>'),
    go: icon('go', '<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4"/>'),
    next: icon('next', '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>')
  };

  function goDesktop(goInfo) {
    if (goInfo.alert) {
      return `<a class="now-item now-go is-alert" href="${esc(goInfo.url)}">${icons.go}<small>GO</small><strong>${esc(goInfo.headline)}</strong></a>`;
    }
    const line = (label, journeys, url) => `<a href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(label)}</b> ${esc(journeys.length ? journeys.map(item => departureLabel(item, false)).join(' · ') : 'Check times')}</a>`;
    return `<div class="now-item now-go">${icons.go}<small>GO</small><div class="now-go-lines">${line('Union', goInfo.union, goTripUrl('UN'))}${line('West Harbour', goInfo.west, goTripUrl('WR'))}</div></div>`;
  }

  function goMobile(goInfo) {
    if (goInfo.alert) {
      return `<a class="now-chip now-chip-go is-alert" href="${esc(goInfo.url)}" aria-label="GO alert: ${esc(goInfo.headline)}">${icons.go}<span><small>GO</small><strong>${esc(goInfo.headline)}</strong></span></a>`;
    }
    const primaryTimes = goInfo.primary.journeys.slice(0, 2).map(item => departureLabel(item, true)).filter(Boolean);
    const secondaryTime = departureLabel(goInfo.secondary.journeys[0] || {}, true);
    const extra = [...goInfo.primary.journeys.slice(0, 3).map(item => `${goInfo.primary.name} ${departureLabel(item, true)}`), ...goInfo.secondary.journeys.slice(0, 2).map(item => `${goInfo.secondary.name} ${departureLabel(item, true)}`)].filter(item => !item.endsWith(' '));
    return `<button type="button" class="now-chip now-chip-go" data-go-toggle aria-expanded="false" aria-controls="nowGoPanel" aria-label="GO ${esc(goInfo.primary.name)} ${esc(primaryTimes.join(' and ') || 'times')}. Tap for more trains.">
      ${icons.go}<span><small>GO</small><strong>${esc(goInfo.primary.name)} ${esc(primaryTimes.join(' · ') || 'times')}</strong>${secondaryTime ? `<em>${esc(goInfo.secondary.name)} ${esc(secondaryTime)}</em>` : ''}</span>
    </button>
    <div class="now-go-panel" id="nowGoPanel" hidden data-go-panel>
      ${extra.map(item => `<span>${esc(item)}</span>`).join('')}
      <a href="${esc(goInfo.primary.url)}" target="_blank" rel="noopener">Full GO schedule</a>
    </div>`;
  }

  function render(payload) {
    const {go, intel, explore, surface} = payload;
    const traffic = trafficItem(surface, intel);
    const skyway = skywayItem(surface);
    const goInfo = goSummary(go);
    const event = nextEvent(explore);
    const eventDesktop = event
      ? `<a class="now-item now-event" href="${esc(event.url)}">${icons.next}<small>Next</small><strong>${esc(event.dateLabel)}</strong><em>${esc(event.fullTitle)}</em></a>`
      : `<div class="now-item now-event">${icons.next}<small>Next</small><strong>See events</strong></div>`;
    const eventMobile = event
      ? `<a class="now-chip now-chip-event" href="${esc(event.url)}" aria-label="${esc(event.title)}, ${esc(event.compactWhen)}">${icons.next}<span><small>${esc(event.title)}</small><strong>${esc(event.compactWhen)}</strong></span></a>`
      : `<a class="now-chip now-chip-event" href="/explore/" aria-label="See Burlington events">${icons.next}<span><small>Events</small><strong>See list</strong></span></a>`;
    const incident = traffic.alert
      ? `<a class="now-incident" href="${esc(traffic.url || '/traffic/')}">
          <small>Traffic</small>
          <strong>${esc(traffic.shortTitle || traffic.title)}</strong>
          <em>${esc(traffic.shortImpact || traffic.meta || traffic.context)}</em>
        </a>`
      : '';

    host.innerHTML = `
      <div class="now-desktop">
        <p class="now-kicker"><i class="now-dot" aria-hidden="true"></i> Live local update</p>
        <div class="now-strip" aria-label="Local status">
          <a class="now-item now-traffic${traffic.alert ? ' is-alert' : ''}" href="${esc(traffic.url || '/traffic/')}">
            ${icons.traffic}
            <small>Traffic</small>
            <strong>${esc(traffic.title)}</strong>
            ${traffic.context ? `<em>${esc(traffic.context)}</em>` : ''}
            ${traffic.impact ? `<em>${esc(traffic.impact)}</em>` : ''}
          </a>
          <span class="now-item now-weather">${icons.weather}<small>Weather</small><strong class="now-weather-value" data-weather-temperature data-weather-compact data-weather-alert-host>--</strong></span>
          <a class="now-item now-skyway${skyway.alert ? ' is-alert' : ''}" href="/traffic/" title="${esc(skyway.detail)}">${icons.skyway}<small>Skyway</small><strong>${esc(skyway.value)}</strong></a>
          ${goDesktop(goInfo)}
          ${eventDesktop}
        </div>
      </div>
      <div class="now-mobile">
        <p class="now-kicker"><i class="now-dot" aria-hidden="true"></i> Live</p>
        ${incident}
        <div class="now-chips" aria-label="Local status">
          <span class="now-chip now-chip-weather">${icons.weather}<span><small>Weather</small><strong class="now-weather-value" data-weather-temperature data-weather-compact data-weather-alert-host>--</strong></span></span>
          ${goMobile(goInfo)}
          <a class="now-chip now-chip-skyway${skyway.alert ? ' is-alert' : ''}" href="/traffic/" aria-label="Skyway ${esc(skyway.compact)}">${icons.skyway}<span><small>Skyway</small><strong>${esc(skyway.compact)}</strong></span></a>
          ${eventMobile}
        </div>
      </div>`;
    host.querySelector('[data-go-toggle]')?.addEventListener('click', event => {
      const button = event.currentTarget;
      const panel = host.querySelector('[data-go-panel]');
      if (!panel) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
    if (window.BurlingtonWeather?.load) window.BurlingtonWeather.load();
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
