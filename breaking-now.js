(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));

  function timestamp(item) {
    const parsed = new Date(item?.lastMeaningfulUpdate || item?.updatedAt || item?.publishedAt || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updateLabel(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return 'UPDATED RECENTLY';
    const time = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto'
    }).format(parsed).replace(/\s/g, ' ').toUpperCase();
    return `UPDATED AT ${time}`;
  }

  function render(doc) {
    const visible = (Array.isArray(doc?.items) ? doc.items : [])
      .filter(item => item?.headline && item?.storyUrl)
      .slice(0, 2);
    if (!visible.length) return;

    const isBreaking = doc?.mode === 'breaking';
    const label = isBreaking ? 'Breaking News' : 'Local Update';
    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = isBreaking ? 'breaking' : 'local-update';
    host.dataset.count = String(visible.length);
    host.dataset.selectionReason = isBreaking
      ? 'strict breaking-news threshold; maximum two'
      : 'fallback live-news ranking: local relevance, freshness, usefulness, confidence and reader interest';
    host.innerHTML = `
      <div class="breaking-heading">
        <strong>${label}</strong>
        <span class="breaking-status"><i aria-hidden="true"></i> ${updateLabel(doc?.generatedAt)}</span>
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
      // Keep the useful server-rendered Local Update already in the page.
    }
  }

  load();
  setInterval(load, 60 * 1000);
})();
