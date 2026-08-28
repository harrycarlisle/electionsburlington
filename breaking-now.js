(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const BREAKING_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  const LOCAL_UPDATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));

  function timestamp(item) {
    const parsed = new Date(item?.lastMeaningfulUpdate || item?.updatedAt || item?.publishedAt || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function ageMs(item) {
    const stamp = timestamp(item);
    return stamp ? Math.max(0, Date.now() - stamp) : Infinity;
  }

  function isMeaningfulUpdate(item) {
    const published = new Date(item?.publishedAt || 0).getTime();
    const updated = new Date(item?.lastMeaningfulUpdate || item?.updatedAt || 0).getTime();
    return Number.isFinite(published) && Number.isFinite(updated) && updated > published + (5 * 60 * 1000);
  }

  function timeLabel(item, multiple) {
    const stamp = timestamp(item);
    if (!stamp) return '';
    const parsed = new Date(stamp);
    const time = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto'
    }).format(parsed).replace(/\s/g, ' ').toUpperCase();
    if (multiple) return `LATEST ${time}`;
    return `${isMeaningfulUpdate(item) ? 'UPDATED' : 'POSTED'} ${time}`;
  }

  function hide() {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
  }

  function render(doc) {
    const visible = (Array.isArray(doc?.items) ? doc.items : [])
      .filter(item => item?.headline && item?.storyUrl && ageMs(item) <= LOCAL_UPDATE_MAX_AGE_MS)
      .sort((a, b) => timestamp(b) - timestamp(a))
      .slice(0, 2);
    if (!visible.length) {
      hide();
      return;
    }

    const freshest = visible[0];
    const isBreaking = doc?.mode === 'breaking' && ageMs(freshest) <= BREAKING_MAX_AGE_MS;
    const label = isBreaking ? 'Breaking News' : 'Local Update';
    const stamp = timeLabel(freshest, visible.length > 1);
    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = isBreaking ? 'breaking' : 'local-update';
    host.dataset.count = String(visible.length);
    host.dataset.selectionReason = isBreaking
      ? 'verified source item published or meaningfully updated within three hours'
      : 'verified local update; breaking treatment expires after three hours';
    host.innerHTML = `
      <div class="breaking-heading">
        <strong>${label}</strong>
        ${stamp ? `<span class="breaking-status">${esc(stamp)}</span>` : ''}
      </div>
      <div class="breaking-list" data-count="${visible.length}">
        ${visible.map(item => `<a class="breaking-row" href="${esc(item.storyUrl)}" data-breaking-score="${esc(item.breakingScore ?? '')}" data-local-update-score="${esc(item.localUpdateScore ?? '')}"${/^https?:\/\//.test(item.storyUrl) ? ' target="_blank" rel="noopener"' : ''}><strong>${esc(item.shortHeadline || item.headline)}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>`).join('')}
      </div>`;
  }

  async function fetchJson(url, timeoutMs = 2200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`live-news ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    try {
      render(await fetchJson('/data/breaking-now.json'));
    } catch (_) {
      // Keep the server-rendered module if the live source cannot be reached.
    }
  }

  load();
  setInterval(load, 60 * 1000);
})();
