(() => {
  const nativeFetch = window.fetch.bind(window);
  const EVENT_PATH = /\/data\/explore-events\.json(?:[?#]|$)/;
  const NEARBY_URL = '/data/explore-events-nearby.json';
  const GRACE_MS = 15 * 60 * 1000;
  const MAX_FUTURE_MS = 550 * 24 * 60 * 60 * 1000;

  const parseTime = value => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const effectiveEnd = event => {
    const end = parseTime(event?.end);
    if (Number.isFinite(end)) return end;
    const start = parseTime(event?.start);
    return Number.isFinite(start) ? start + (3 * 60 * 60 * 1000) : NaN;
  };

  const verifiedValue = event => parseTime(event?.verifiedAt) || 0;
  const scopeRank = event => {
    const scope = `${event?.scope || ''} ${event?.city || ''}`.toLowerCase();
    if (scope.includes('burlington')) return 0;
    if (scope.includes('oakville') || scope.includes('hamilton') || scope.includes('stoney creek')) return 1;
    return 2;
  };

  function mergeAndFilter(primary, regional) {
    const now = Date.now();
    const merged = new Map();
    [...(primary || []), ...(regional || [])].forEach(event => {
      if (!event?.id || !event?.title) return;
      const start = parseTime(event.start);
      const end = effectiveEnd(event);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      if (end < now - GRACE_MS || start > now + MAX_FUTURE_MS) return;
      const previous = merged.get(event.id);
      if (!previous || verifiedValue(event) >= verifiedValue(previous)) merged.set(event.id, event);
    });
    return [...merged.values()].sort((a, b) => {
      const startDiff = parseTime(a.start) - parseTime(b.start);
      if (startDiff) return startDiff;
      const scopeDiff = scopeRank(a) - scopeRank(b);
      if (scopeDiff) return scopeDiff;
      return Number(b.weight || 0) - Number(a.weight || 0);
    });
  }

  window.fetch = async function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const response = await nativeFetch(input, init);
    if (!EVENT_PATH.test(url)) return response;

    try {
      const payload = await response.clone().json();
      let regional = {events: []};
      try {
        const nearbyResponse = await nativeFetch(NEARBY_URL, {cache: 'no-store'});
        if (nearbyResponse.ok) regional = await nearbyResponse.json();
      } catch (_) {}

      payload.events = mergeAndFilter(payload.events, regional.events);
      payload.updated = new Date().toISOString();
      payload.freshnessPolicy = 'Events leave Explore shortly after their scheduled end time. Nearby Oakville, Hamilton and Stoney Creek events are included when useful to Burlington readers.';

      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    } catch (_) {
      return response;
    }
  };

  function tidyRenderedCopy() {
    document.querySelectorAll('.publication-credit').forEach(node => {
      const text = node.textContent || '';
      if (/Event details were checked/i.test(text)) {
        node.textContent = text.replace(/Event details were checked[^.]*\./i, 'Event details are monitored; confirm with the organizer before leaving.');
      }
    });
  }

  let openedFromQuery = false;
  function openRequestedEvent() {
    if (openedFromQuery) return;
    const requested = new URLSearchParams(location.search).get('event');
    if (!requested) return;
    const button = document.querySelector(`[data-event="${CSS.escape(requested)}"]`);
    if (!button) return;
    openedFromQuery = true;
    button.click();
  }

  const observer = new MutationObserver(() => {
    tidyRenderedCopy();
    openRequestedEvent();
  });
  observer.observe(document.documentElement, {subtree: true, childList: true});
  addEventListener('DOMContentLoaded', () => {
    tidyRenderedCopy();
    openRequestedEvent();
  }, {once: true});
})();
