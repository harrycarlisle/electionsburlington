(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  if (!document.querySelector('link[data-style="breaking-morningtee"]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/breaking-morningtee.css?v=20260827live1';
    style.dataset.style = 'breaking-morningtee';
    document.head.appendChild(style);
  }

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function hide() {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.dataset.state = 'empty';
    host.dataset.count = '0';
    host.innerHTML = '';
  }

  function timestamp(item) {
    const parsed = new Date(item?.lastMeaningfulUpdate || item?.updatedAt || item?.publishedAt || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updateLabel(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return 'UPDATED NOW';
    const time = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto'
    }).format(parsed).replace(/\s/g, ' ').toUpperCase();
    return `UPDATED AT ${time}`;
  }

  function render(doc) {
    const visible = (Array.isArray(doc?.items) ? doc.items : [])
      .filter(item => item?.headline && item?.storyUrl)
      .slice(0, 2);
    if (!visible.length) return hide();

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

  async function load() {
    try {
      const response = await fetch('/data/breaking-now.json', {cache:'no-store'});
      if (!response.ok) throw new Error(`live-news ${response.status}`);
      render(await response.json());
    } catch (_) {
      hide();
    }
  }

  hide();
  load();
  setInterval(load, 60 * 1000);
})();
