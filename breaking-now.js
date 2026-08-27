(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  if (!document.querySelector('link[data-style="breaking-morningtee"]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/breaking-morningtee.css?v=20260827b';
    style.dataset.style = 'breaking-morningtee';
    document.head.appendChild(style);
  }

  // Temporary homepage fixtures for the focused Breaking News design pass.
  // Keep these local to the component so the rest of the homepage/data pipeline is untouched.
  const FEATURED_TWO = [
    {
      id: 'road-closures',
      headline: 'Road closures are coming to Burlington this month.',
      shortHeadline: 'Road closures are coming to Burlington this month.',
      storyUrl: '/news/'
    },
    {
      id: 'toss-bosses',
      headline: 'This Burlington team has lost 24 straight games. Why do they keep coming back?',
      shortHeadline: 'Burlington team loses 24 straight games. Why keep coming back?',
      storyUrl: '/stories/burlington-ultimate-team-0-24/'
    }
  ];

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function updateLabel() {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto'
    }).format(now).replace(/\s/g, ' ').toUpperCase();
    return `UPDATED AT ${time}`;
  }

  function render(items) {
    const visible = (Array.isArray(items) ? items : []).filter(item => item?.headline).slice(0, 2);
    if (!visible.length) return;

    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = 'ready';
    host.dataset.count = String(visible.length);
    host.innerHTML = `
      <div class="breaking-heading">
        <strong>Breaking News</strong>
        <span class="breaking-status"><i aria-hidden="true"></i> ${updateLabel()}</span>
      </div>
      <div class="breaking-list" data-count="${visible.length}">
        ${visible.map(item => `<a class="breaking-row" href="${esc(item.storyUrl || '/news/')}"><strong>${esc(item.shortHeadline || item.headline)}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>`).join('')}
      </div>`;
  }

  render(FEATURED_TWO);
})();
