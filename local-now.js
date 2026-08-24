(() => {
  const host = document.getElementById('localNow');
  if (!host) return;
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
  const isLocalDemo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('demo') === 'live';
  const source = isLocalDemo ? 'data/fixtures/local-status.demo.json' : 'data/local-status.json';
  const serviceMarkup = service => {
    if (service.kind === 'client_weather') return `<span class="now-service"><small>${esc(service.label)}</small><strong data-weather-temperature hidden></strong></span>`;
    const external = /^https?:\/\//.test(service.url || '');
    return `<a class="now-service" href="${esc(service.url)}"${external ? ' target="_blank" rel="noopener"' : ''}><small>${esc(service.label)}</small><strong>${esc(service.value)}</strong></a>`;
  };
  fetch(source,{cache:'no-store'}).then(response => response.ok ? response.json() : Promise.reject()).then(data => {
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    const recent = Array.isArray(data.recentlyLive) ? data.recentlyLive : [];
    const current = incidents[0];
    const incidentMarkup = current ? `<article class="now-incident is-${esc(current.status)}"><div><span class="now-state">${data.fixture ? 'Demo fixture' : esc(current.status)}</span><h2>${esc(current.headline)}</h2><p>${esc(current.impact || '')}</p></div><div class="now-meta"><span>${esc(current.location?.label || '')}</span><time>${relative(current.lastUpdatedAt)}</time><small>${esc(current.sourceName || '')}</small></div></article>` : `<div class="now-empty"><strong>${esc(data.headline || 'No active alert published')}</strong><span>${esc(data.summary || '')}</span></div>`;
    const recentMarkup = recent.length ? `<div class="recently-live"><span>Recently live</span>${recent.slice(0,2).map(item => `<a href="${esc(item.url || 'updates.html')}"><strong>${esc(item.headline)}</strong><small>${esc(item.status || 'Resolved')} ${relative(item.resolvedAt)}</small></a>`).join('')}</div>` : '';
    host.innerHTML = `<div class="now-heading"><span>Right now</span><time>Checked ${relative(data.generatedAt)}</time></div>${incidentMarkup}<div class="now-services">${(data.services || []).map(serviceMarkup).join('')}</div>${recentMarkup}`;
    if (window.BurlingtonWeather?.load) window.BurlingtonWeather.load();
  }).catch(() => { host.hidden = true; });
})();
