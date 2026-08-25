(() => {
  const host = document.getElementById('localNow');
  if (!host) return;
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const torontoDay = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(value ? new Date(value) : new Date());
  const shortDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', month:'short', day:'numeric'}).format(new Date(value));
  const goTripUrl = destination => `https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(torontoDay())}&transfers=true`;

  function timeOnly(value) {
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour24 = Number(match[1]) % 24;
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    const hour = hour24 % 12 || 12;
    return `${hour}:${match[2]} ${suffix}`;
  }

  function departureLabel(journey) {
    const raw = journey.computedDeparture || journey.departure;
    const time = timeOnly(raw);
    if (!time) return '';
    const status = String(journey.departureStatus || '');
    if (journey.computedDeparture && /late|delay|delayed/i.test(status)) return `${time} delayed`;
    return time;
  }

  function routeTimes(data, code) {
    const route = (Array.isArray(data?.routes) ? data.routes : []).find(item => String(item.destination?.stopCode || '').toUpperCase() === code);
    return (Array.isArray(route?.journeys) ? route.journeys : []).slice(0, 2).map(departureLabel).filter(Boolean);
  }

  function goSummary(data) {
    const alert = Array.isArray(data?.alerts) && data.alerts[0];
    if (alert) return {alert:true, headline:alert.headline || 'Service alert', url:data.liveStatusUrl || 'https://www.gotransit.com/en/service-updates/service-updates'};
    return {union:routeTimes(data, 'UN'), west:routeTimes(data, 'WR')};
  }

  function nextEvent(data) {
    const now = Date.now();
    const events = (Array.isArray(data?.events) ? data.events : []).filter(item => Date.parse(item.end || item.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const event = events[0];
    if (!event) return null;
    return {title:event.title, dateLabel:shortDate(event.start), url:`/explore/#event-${encodeURIComponent(event.id || '')}`};
  }

  function trafficItem(surface, intel) {
    const ready = surface?.homepageTraffic;
    if (ready?.title) return ready;
    const incidents = Array.isArray(surface?.incidents) ? surface.incidents : [];
    const local = incidents.find(item => item.type === 'closure' || item.type === 'collision');
    if (local) {
      return {
        title: local.title,
        context: [local.municipality, local.nearestRoad, local.updatedLabel].filter(Boolean).join(' · '),
        impact: local.impact || '',
        url: '/traffic/',
        alert: true
      };
    }
    const top = intel?.topSignal;
    if (top && Number(top.score) >= 90) {
      const hay = `${top.headline || ''} ${top.location || ''}`.toLowerCase();
      if (/burlington|skyway|qew|oakville|hamilton/.test(hay) && /collision|closure|closed/.test(hay)) {
        return {title:top.headline, context:top.location || '', url:top.url || '/traffic/', alert:true};
      }
    }
    return {title:'Check cameras', context:'Downtown Burlington routes', url:'/traffic/', alert:false};
  }

  function skywayItem(surface) {
    const skyway = surface?.skyway;
    if (skyway?.value) return {value:skyway.value, alert:Boolean(skyway.alert), detail:skyway.detail || ''};
    return {value:'Check cameras', alert:false, detail:''};
  }

  function render(payload) {
    const {go, intel, explore, surface} = payload;
    const traffic = trafficItem(surface, intel);
    const skyway = skywayItem(surface);
    const goInfo = goSummary(go);
    const event = nextEvent(explore);
    const goMarkup = goInfo.alert
      ? `<a class="now-item now-go is-alert" href="${esc(goInfo.url)}"><small>GO</small><strong>${esc(goInfo.headline)}</strong></a>`
      : `<div class="now-item now-go"><small>GO</small><div class="now-go-lines"><a href="${esc(goTripUrl('UN'))}" target="_blank" rel="noopener"><b>Union</b> ${esc(goInfo.union.length ? goInfo.union.join(' · ') : 'Check times')}</a><a href="${esc(goTripUrl('WR'))}" target="_blank" rel="noopener"><b>West Harbour</b> ${esc(goInfo.west.length ? goInfo.west.join(' · ') : 'Check times')}</a></div></div>`;
    const eventMarkup = event
      ? `<a class="now-item now-event" href="${esc(event.url)}"><small>Next</small><strong>${esc(event.dateLabel)} · ${esc(event.title)}</strong></a>`
      : '';
    host.innerHTML = `<div class="now-strip" aria-label="Local status">
      <a class="now-item now-traffic${traffic.alert ? ' is-alert' : ''}" href="${esc(traffic.url || '/traffic/')}">
        <small>Traffic</small>
        <strong>${esc(traffic.title)}</strong>
        ${traffic.context ? `<em>${esc(traffic.context)}</em>` : ''}
        ${traffic.impact ? `<em>${esc(traffic.impact)}</em>` : ''}
      </a>
      <span class="now-item now-weather"><small>Weather</small><strong class="now-weather-value" data-weather-temperature data-weather-compact data-weather-alert-host>--</strong></span>
      <a class="now-item now-skyway${skyway.alert ? ' is-alert' : ''}" href="/traffic/" title="${esc(skyway.detail)}"><small>Skyway</small><strong>${esc(skyway.value)}</strong></a>
      ${goMarkup}
      ${eventMarkup}
    </div>`;
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
