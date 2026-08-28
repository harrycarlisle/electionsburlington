(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const BREAKING_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  const LOCAL_UPDATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));

  function storyUrl(item) {
    return item?.storyUrl || item?.url || '';
  }

  function timestamp(item) {
    const candidates = [item?.lastMeaningfulUpdate, item?.meaningfulUpdatedAt, item?.publishedAt, item?.datePublished];
    for (const value of candidates) {
      const parsed = new Date(value || 0).getTime();
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }

  function ageMs(item) {
    const stamp = timestamp(item);
    return stamp ? Math.max(0, Date.now() - stamp) : Infinity;
  }

  function hasMeaningfulUpdate(item) {
    const published = new Date(item?.publishedAt || item?.datePublished || 0).getTime();
    const updated = new Date(item?.lastMeaningfulUpdate || item?.meaningfulUpdatedAt || 0).getTime();
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
    return `${hasMeaningfulUpdate(item) ? 'UPDATED' : 'POSTED'} ${time}`;
  }

  function unique(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item?.id || storyUrl(item) || item?.headline;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function hide() {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
  }

  function render(doc, archiveDoc = {}) {
    const current = Array.isArray(doc?.items) ? doc.items : [];
    const archive = Array.isArray(archiveDoc?.items) ? archiveDoc.items : [];
    const visible = unique([...current, ...archive])
      .filter(item => item?.headline && storyUrl(item) && ageMs(item) <= LOCAL_UPDATE_MAX_AGE_MS)
      .sort((a, b) => timestamp(b) - timestamp(a))
      .slice(0, 2);

    if (!visible.length) {
      hide();
      return;
    }

    const freshest = visible[0];
    const currentIds = new Set(current.map(item => item?.id).filter(Boolean));
    const isBreaking = doc?.mode === 'breaking' && currentIds.has(freshest?.id) && ageMs(freshest) <= BREAKING_MAX_AGE_MS;
    const label = isBreaking ? 'Breaking News' : 'Local Update';
    const stamp = timeLabel(freshest, visible.length > 1);

    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = isBreaking ? 'breaking' : 'local-update';
    host.dataset.count = String(visible.length);
    host.dataset.selectionReason = isBreaking
      ? 'verified story published or meaningfully updated within three hours'
      : 'recent verified local story; breaking treatment expires after three hours';

    host.innerHTML = `
      <div class="breaking-heading">
        <strong>${label}</strong>
        ${stamp ? `<span class="breaking-status">${esc(stamp)}</span>` : ''}
      </div>
      <div class="breaking-list" data-count="${visible.length}">
        ${visible.map(item => {
          const href = storyUrl(item);
          return `<a class="breaking-row" href="${esc(href)}" data-breaking-score="${esc(item.breakingScore ?? '')}" data-local-update-score="${esc(item.localUpdateScore ?? '')}"${/^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : ''}><strong>${esc(item.shortHeadline || item.headline)}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>`;
  }

  async function fetchJson(url, timeoutMs = 2200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {cache:'no-store', signal:controller.signal});
      if (!response.ok) return {};
      return await response.json();
    } catch (_) {
      return {};
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    const [live, archive] = await Promise.all([
      fetchJson('/data/breaking-now.json'),
      fetchJson('/data/breaking-archive.json')
    ]);
    render(live, archive);
  }

  load();
  setInterval(load, 60 * 1000);
})();
