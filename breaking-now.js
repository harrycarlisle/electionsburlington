(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function heroUrl() {
    return document.querySelector('.top-story a')?.getAttribute('href') || '';
  }

  function hide(reason) {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    host.dataset.state = reason || 'empty';
  }

  function render(payload) {
    const hero = heroUrl();
    const items = (Array.isArray(payload?.items) ? payload.items : [])
      .filter(item => item?.headline && item.storyUrl !== hero)
      .slice(0, 2);
    if (!items.length) {
      hide(payload && Array.isArray(payload.items) ? 'empty' : 'unavailable');
      return;
    }
    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = 'ready';
    host.innerHTML = `
      <p class="breaking-kicker"><i class="now-dot" aria-hidden="true"></i> Breaking now</p>
      <div class="breaking-list">
        ${items.map(item => {
          const href = item.storyUrl || `/live/?id=${encodeURIComponent(item.id || '')}`;
          const label = item.label ? `<small>${esc(item.label)}</small>` : '';
          return `<a class="breaking-row" href="${esc(href)}">${label}<strong>${esc(item.shortHeadline || item.headline)}</strong><span aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>`;
  }

  function load() {
    fetch('/data/breaking-now.json', {cache:'no-store'})
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data) {
          hide('unavailable');
          return;
        }
        render(data);
      })
      .catch(() => hide('unavailable'));
  }

  hide('pending');
  load();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
  window.setInterval(() => {
    if (!document.hidden) load();
  }, 5 * 60 * 1000);
})();
