(() => {
  const main = document.querySelector('.live-update');
  if (!main) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function requestedId() {
    const params = new URLSearchParams(location.search);
    return params.get('id') || location.hash.replace(/^#/, '') || '';
  }

  function when(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Toronto', weekday:'short', month:'short', day:'numeric',
      hour:'numeric', minute:'2-digit'
    }).format(date);
  }

  function attribution(item) {
    const name = item.sourceName || 'Official sources';
    if (/511/i.test(name)) return `Ontario 511 reports ${item.summary || item.headline}`;
    if (/metrolinx|go transit/i.test(name)) return `GO Transit says ${item.summary || item.headline}`;
    if (/police/i.test(name)) return `According to ${name}, ${item.summary || item.headline}`;
    return `According to ${name}.`;
  }

  fetch('/data/breaking-now.json', {cache:'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      const items = Array.isArray(data?.items) ? data.items : [];
      const id = requestedId();
      const item = items.find(row => row.id === id) || items[0];
      if (!item) {
        main.innerHTML = '<p class="live-empty">There is no verified live update to show right now.</p>';
        return;
      }
      document.title = `${item.shortHeadline || item.headline} | Burlington News`;
      const sources = [{sourceName:item.sourceName, sourceUrl:item.sourceUrl}].concat(item.relatedSources || []).filter(row => row.sourceUrl);
      main.innerHTML = `
        <p class="kicker">${esc(item.category || 'Live update')}</p>
        <h1>${esc(item.headline)}</h1>
        <p class="lede">${esc(item.summary || attribution(item))}</p>
        <p class="meta">${[item.location || item.nearestIntersection, when(item.updatedAt || item.publishedAt), item.cause].filter(Boolean).map(esc).join(' · ')}</p>
        <p>${esc(attribution(item))}</p>
        <div class="sources">
          <strong>Sources</strong>
          ${sources.map(row => `<a href="${esc(row.sourceUrl)}" rel="noopener">${esc(row.sourceName || row.sourceUrl)}</a>`).join('') || '<p>Source links will appear here when a public URL is available.</p>'}
        </div>`;
    })
    .catch(() => {
      main.innerHTML = '<p class="live-empty">This update could not be loaded.</p>';
    });
})();
