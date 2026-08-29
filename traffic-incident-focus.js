(() => {
  const params = new URLSearchParams(location.search);
  const incidentId = params.get('incident');
  if (!incidentId) return;

  const destination = params.get('destination') || params.get('route') || 'toronto';

  async function incidentIndex() {
    try {
      const response = await fetch('/data/traffic-surface.json', { cache: 'no-store' });
      if (!response.ok) return -1;
      const data = await response.json();
      const incidents = (data?.routes?.[destination]?.incidents || [])
        .filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
      return incidents.findIndex(item => String(item.id || '') === incidentId);
    } catch (_) {
      return -1;
    }
  }

  async function focus() {
    const targetIndex = await incidentIndex();
    if (targetIndex < 0) return;

    const map = document.getElementById('routeMap');
    map?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const markers = document.querySelectorAll('#routeMap .route-incident');
      const marker = markers[targetIndex];
      if (marker) {
        window.clearInterval(timer);
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        marker.classList.add('is-linked-incident');
        window.setTimeout(() => marker.classList.remove('is-linked-incident'), 3500);
      } else if (attempts >= 40) {
        window.clearInterval(timer);
      }
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', focus, { once: true });
  else focus();
})();
