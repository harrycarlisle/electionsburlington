(() => {
  const host = document.getElementById('localNow');
  if (!host) return;
  if (!document.getElementById('goRouteStyles')) {
    const style = document.createElement('style');
    style.id = 'goRouteStyles';
    style.textContent = '.now-go-routes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.now-go-route{display:grid;gap:5px;color:var(--navy);text-decoration:none}.now-go-route+b{margin-top:0}.now-go-route>b{font:700 17px/1.1 var(--publication-serif)}.now-go-route+.now-go-route{padding-left:18px;border-left:1px solid var(--line)}@media(max-width:680px){.now-go-routes{grid-template-columns:1fr;gap:12px}.now-go-route+.now-go-route{padding-left:0;padding-top:12px;border-left:0;border-top:1px solid var(--line)}}';
    document.head.appendChild(style);
  }
  const esc = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const relative = value => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 2) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} hr ago` : new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric'}).format(date);
  };
  const formatTime = value => {
    if (!value) return '';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return String(value);
    const hour = Number(match[1]);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${match[2]} ${suffix}`;
  };
  const isFresh = (value,maxMinutes=90) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && Date.now() - date.getTime() <= maxMinutes * 60000;
  };
  const isLocalDemo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('demo') === 'live';
  const source = isLocalDemo ? 'data/fixtures/local-status.demo.json' : 'data/local-status.json';
  const serviceMarkup = service => {
    if (service.kind === 'client_weather') return `<span class="now-service"><small>${esc(service.label)}</small><strong data-weather-temperature hidden></strong></span>`;
    const external = /^https?:\/\//.test(service.url || '');
    return `<a class="now-service" href="${esc(service.url)}"${external ? ' target="_blank" rel="noopener"' : ''}><small>${esc(service.label)}</small><strong>${esc(service.value)}</strong></a>`;
  };
  const routeMarkup = (data, route) => {
    const realtime = data.dataKind === 'realtime';
    const journeys = Array.isArray(route.journeys) ? route.journeys.slice(0,3) : [];
    if (!journeys.length) return '';
    const times = journeys.map(item => {
      const predicted = realtime && item.computedDeparture;
      const status = predicted && item.departureStatus ? ` <small>${esc(item.departureStatus)}</small>` : '';
      return `<strong>${esc(formatTime(predicted || item.departure))}${status}</strong>`;
    }).join('<span aria-hidden="true">·</span>');
    const first = journeys[0] || {};
    const duration = first.duration ? `<span>${esc(first.duration)} to ${esc(route.destination?.label || '')}</span>` : '';
    const platform = first.platform ? `<span>Platform ${esc(first.platform)}</span>` : '';
    return `<a class="now-go-route" href="${esc(data.liveStatusUrl || 'https://www.gotransit.com/en/see-schedules')}" target="_blank" rel="noopener"><b>${esc(route.origin?.label || 'Burlington')} → ${esc(route.destination?.label || '')}</b><div class="now-go-times">${times}</div><div class="now-go-meta"><span>${esc(data.route || 'Lakeshore West')}</span>${duration}${platform}</div></a>`;
  };
  const goMarkup = data => {
    if (!data || !isFresh(data.generatedAt,90)) return '';
    const routes = Array.isArray(data.routes) ? data.routes : (Array.isArray(data.journeys) && data.journeys.length ? [{origin:data.origin,destination:data.destination,journeys:data.journeys}] : []);
    const routeHtml = routes.map(route => routeMarkup(data, route)).filter(Boolean).join('');
    if (!routeHtml) return '';
    const alert = Array.isArray(data.alerts) && data.alerts.length ? `<div class="now-go-alert"><strong>${esc(data.alerts[0].headline || 'GO service update')}</strong>${data.alerts[0].detail ? `<span>${esc(data.alerts[0].detail)}</span>` : ''}</div>` : '';
    return `<section class="now-go" aria-label="GO train times"><div class="now-go-head"><span>GO train</span><small>${data.dataKind === 'realtime' ? 'Realtime' : 'Scheduled'}</small></div><div class="now-go-routes">${routeHtml}</div>${alert}</section>`;
  };
  Promise.allSettled([
    fetch(source,{cache:'no-store'}).then(response => response.ok ? response.json() : Promise.reject()),
    fetch('data/go-status.json',{cache:'no-store'}).then(response => response.ok ? response.json() : null).catch(() => null)
  ]).then(results => {
    if (results[0].status !== 'fulfilled') { host.hidden = true; return; }
    const data = results[0].value;
    const go = results[1].status === 'fulfilled' ? results[1].value : null;
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    const recent = Array.isArray(data.recentlyLive) ? data.recentlyLive : [];
    const current = incidents[0];
    const goContent = goMarkup(go);
    const incidentMarkup = current ? `<article class="now-incident is-${esc(current.status)}"><div><span class="now-state">${data.fixture ? 'Demo fixture' : esc(current.status)}</span><h2>${esc(current.headline)}</h2><p>${esc(current.impact || '')}</p></div><div class="now-meta"><span>${esc(current.location?.label || '')}</span><time>${relative(current.lastUpdatedAt)}</time><small>${esc(current.sourceName || '')}</small></div></article>` : '';
    const quietMarkup = !current && !goContent ? `<div class="now-empty"><strong>${esc(data.headline || 'No active alert published')}</strong><span>${esc(data.summary || '')}</span></div>` : '';
    const recentMarkup = recent.length ? `<div class="recently-live"><span>Recently live</span>${recent.slice(0,2).map(item => `<a href="${esc(item.url || 'updates.html')}"><strong>${esc(item.headline)}</strong><small>${esc(item.status || 'Resolved')} ${relative(item.resolvedAt)}</small></a>`).join('')}</div>` : '';
    host.innerHTML = `<div class="now-heading"><span>Right now</span><time>Checked ${relative(data.generatedAt)}</time></div>${incidentMarkup}${goContent}${quietMarkup}<div class="now-services">${(data.services || []).map(serviceMarkup).join('')}</div>${recentMarkup}`;
    if (window.BurlingtonWeather?.load) window.BurlingtonWeather.load();
  }).catch(() => { host.hidden = true; });
})();
