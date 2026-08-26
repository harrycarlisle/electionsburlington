(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const QA_TWO = [
    {
      id: 'qa-crime',
      headline: 'How bad is crime in Burlington, really?',
      shortHeadline: 'How bad is crime in Burlington, really?',
      storyUrl: '/stories/how-bad-is-burlington-crime/'
    },
    {
      id: 'qa-data-centre',
      headline: 'Burlington’s proposed data centre is not what many people think.',
      shortHeadline: 'Burlington’s proposed data centre is not what many people think.',
      storyUrl: '/stories/burlington-data-centre-not-ai/'
    }
  ];

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function heroUrl() {
    return document.querySelector('.top-story a')?.getAttribute('href') || '';
  }

  function hide(reason) {
    host.hidden = true;
    host.classList.add('is-empty');
    host.setAttribute('aria-hidden', 'true');
    host.removeAttribute('data-count');
    host.innerHTML = '';
    host.dataset.state = reason || 'empty';
  }

  function render(payload) {
    const hero = payload?.generatedAt === 'qa' ? '' : heroUrl();
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
    host.dataset.count = String(items.length);
    host.innerHTML = `
      <p class="breaking-kicker"><i class="now-dot" aria-hidden="true"></i> Breaking now</p>
      <div class="breaking-list" data-count="${items.length}">
        ${items.map(item => {
          const href = item.storyUrl || `/live/?id=${encodeURIComponent(item.id || '')}`;
          const label = item.label ? `<small>${esc(item.label)}</small>` : '';
          return `<a class="breaking-row" href="${esc(href)}">${label}<strong>${esc(item.shortHeadline || item.headline)}</strong><span aria-hidden="true">›</span></a>`;
        }).join('')}
      </div>`;
  }

  function qaItems() {
    const qa = new URLSearchParams(location.search).get('qa');
    if (qa === 'breaking-2') return {items: QA_TWO, generatedAt: 'qa'};
    if (qa === 'breaking-1') return {items: QA_TWO.slice(0, 1), generatedAt: 'qa'};
    return null;
  }

  function load() {
    const fixture = qaItems();
    if (fixture) {
      render(fixture);
      return;
    }
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
