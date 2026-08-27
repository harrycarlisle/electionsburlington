(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  if (!document.querySelector('link[data-style="breaking-morningtee"]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/breaking-morningtee.css?v=20260827e';
    style.dataset.style = 'breaking-morningtee';
    document.head.appendChild(style);
  }

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const MAX_AGE_MS = 18 * 60 * 60 * 1000;

  function hide() {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.dataset.state = 'empty';
    host.dataset.count = '0';
    host.innerHTML = '';
  }

  function timestamp(item) {
    const parsed = new Date(item?.lastMeaningfulUpdate || item?.publishedAt || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isCurrent(item, now = Date.now()) {
    const stamp = timestamp(item);
    if (!stamp || now - stamp > MAX_AGE_MS) return false;
    const priority = String(item?.priority || item?.severity || item?.type || '').toLowerCase();
    return item?.breaking === true || item?.urgent === true || /breaking|urgent|emergency|critical|closure|incident|warning|alert/.test(priority);
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
    const now = Date.now();
    const visible = (Array.isArray(doc?.items) ? doc.items : [])
      .filter(item => item?.headline && item?.storyUrl && isCurrent(item, now))
      .sort((a,b) => timestamp(b) - timestamp(a))
      .slice(0, 2);
    if (!visible.length) return hide();

    const latest = Math.max(...visible.map(timestamp));
    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = 'ready';
    host.dataset.count = String(visible.length);
    host.innerHTML = `
      <div class="breaking-heading">
        <strong>Breaking News</strong>
        <span class="breaking-status"><i aria-hidden="true"></i> ${updateLabel(latest || doc?.generatedAt)}</span>
      </div>
      <div class="breaking-list" data-count="${visible.length}">
        ${visible.map(item => `<a class="breaking-row" href="${esc(item.storyUrl)}"${/^https?:\/\//.test(item.storyUrl) ? ' target="_blank" rel="noopener"' : ''}><strong>${esc(item.shortHeadline || item.headline)}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>`).join('')}
      </div>`;
  }

  async function load() {
    try {
      const response = await fetch('/data/breaking-now.json', {cache:'no-store'});
      if (!response.ok) throw new Error(`breaking ${response.status}`);
      render(await response.json());
    } catch (_) {
      hide();
    }
  }

  hide();
  load();
  setInterval(load, 60 * 1000);
})();
