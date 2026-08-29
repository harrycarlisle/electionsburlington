(() => {
  let surfacePromise = null;

  function trafficSurface() {
    if (!surfacePromise) {
      surfacePromise = fetch('/data/traffic-surface.json', { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .catch(() => null);
    }
    return surfacePromise;
  }

  function matchingIncident(surface, card) {
    const detail = (card.querySelector('em')?.textContent || '').trim().toLowerCase();
    const title = (card.querySelector('strong')?.textContent || '').trim().toLowerCase();
    const rows = Array.isArray(surface?.incidents) ? surface.incidents : [];
    return rows.find(item => {
      const incidentTitle = String(item?.title || '').trim().toLowerCase();
      if (!incidentTitle) return false;
      return detail === incidentTitle || detail.includes(incidentTitle) || incidentTitle.includes(detail) || title.includes(String(item?.roadway || '').toLowerCase());
    }) || rows[0] || null;
  }

  function bestRoute(surface, incident) {
    const matches = Object.entries(surface?.routes || {})
      .filter(([, route]) => (route?.incidents || []).some(item => String(item?.id || '') === String(incident?.id || '')))
      .sort((a, b) => Number(a[1]?.metres || Infinity) - Number(b[1]?.metres || Infinity));
    if (matches.length) return matches[0][0];

    const place = `${incident?.municipality || ''} ${incident?.context || ''}`.toLowerCase();
    if (/hamilton|stoney|niagara/.test(place)) return 'hamilton';
    if (/oakville/.test(place)) return 'oakville';
    return 'toronto';
  }

  async function syncCard(card) {
    if (!card || !card.classList.contains('is-alert')) return;
    const surface = await trafficSurface();
    if (!surface || !card.isConnected) return;
    const incident = matchingIncident(surface, card);
    if (!incident) return;
    const route = bestRoute(surface, incident);
    const params = new URLSearchParams();
    params.set('destination', route);
    if (incident.id) params.set('incident', String(incident.id));
    card.href = `/traffic/?${params.toString()}#routeMap`;
    card.dataset.incidentId = String(incident.id || '');
  }

  function sync() {
    document.querySelectorAll('#localNow .now-card-driving.is-alert, #headerLive .now-card-driving.is-alert')
      .forEach(card => syncCard(card));
  }

  const observer = new MutationObserver(sync);
  const start = () => {
    sync();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
