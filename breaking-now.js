(() => {
  const host = document.getElementById('breakingNow');
  if (!host) return;

  const BREAKING_MAX_AGE_MS = 3 * 60 * 60 * 1000;
  const LOCAL_UPDATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const displayHeadline = value => String(value || '').trim().replace(/\.+$/, '');

  function storyUrl(item) {
    return item?.storyUrl || item?.url || '';
  }

  function timestamp(item) {
    const candidates = [item?.contextTimestamp, item?.lastMeaningfulUpdate, item?.meaningfulUpdatedAt, item?.publishedAt, item?.datePublished];
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

  function editorialFamily(item) {
    const value = `${item?.editorialFamily || ''} ${item?.kind || ''} ${item?.label || ''} ${item?.category || ''} ${item?.topic || ''}`.toLowerCase();
    if (/home rules|permit|parking|bylaw|service/.test(value)) return 'service';
    if (/public safety|police|crime|shooting|fire/.test(value)) return 'public-safety';
    if (/traffic|transport|road|qew|collision/.test(value)) return 'traffic';
    if (/history|mystery|heritage/.test(value)) return 'history';
    if (/development|construction|housing/.test(value)) return 'development';
    if (/food|restaurant|drink/.test(value)) return 'food';
    if (/sport/.test(value)) return 'sports';
    if (/event|festival/.test(value)) return 'events';
    if (/school|education/.test(value)) return 'schools';
    if (/election|council|politic/.test(value)) return 'civic';
    return String(item?.category || item?.topic || item?.label || item?.id || 'other').toLowerCase();
  }

  function contextScore(item) {
    if (item?.localUpdateEligible === false) return 0;
    if (item?.anniversaryMatch || item?.localUpdateReason === 'anniversary') return 5;
    if (item?.localUpdateReason || item?.contextSignal || item?.relatedCurrentEvent) return 5;
    if (hasMeaningfulUpdate(item)) return 4;
    const source = String(item?.sourceName || '').trim().toLowerCase();
    if (source === 'burlington news') return 0;
    return source ? 3 : 0;
  }

  function localRank(item) {
    return Number(item?.localUpdateScore || 0) + contextScore(item) * 0.75;
  }

  function pickDiverse(items, limit = 2) {
    const picked = [];
    const families = new Set();
    for (const item of items) {
      const family = editorialFamily(item);
      if (families.has(family)) continue;
      picked.push(item);
      families.add(family);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  function timeLabel(item, multiple) {
    const stamp = timestamp(item);
    if (!stamp) return '';
    const parsed = new Date(stamp);
    const time = new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto'
    }).format(parsed).replace(/\s/g, ' ').toUpperCase();
    if (multiple) return `LATEST ${time}`;
    if (item?.contextTimestamp && !hasMeaningfulUpdate(item)) return `RELEVANT ${time}`;
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

  function render(doc) {
    const current = unique(Array.isArray(doc?.items) ? doc.items : [])
      .filter(item => item?.headline && storyUrl(item) && ageMs(item) <= LOCAL_UPDATE_MAX_AGE_MS);

    const breaking = doc?.mode === 'breaking'
      ? current
          .filter(item => ageMs(item) <= BREAKING_MAX_AGE_MS)
          .sort((a, b) => timestamp(b) - timestamp(a))
      : [];

    const isBreaking = breaking.length > 0;
    const visible = isBreaking
      ? pickDiverse(breaking, 2)
      : pickDiverse(
          current
            .filter(item => contextScore(item) > 0)
            .sort((a, b) => localRank(b) - localRank(a) || timestamp(b) - timestamp(a)),
          2
        );

    if (!visible.length) {
      hide();
      return;
    }

    const freshest = visible[0];
    const label = isBreaking ? 'Breaking News' : 'Local Update';
    const stamp = timeLabel(freshest, visible.length > 1);

    host.hidden = false;
    host.classList.remove('is-empty');
    host.removeAttribute('aria-hidden');
    host.dataset.state = isBreaking ? 'breaking' : 'local-update';
    host.dataset.count = String(visible.length);
    host.dataset.selectionReason = isBreaking
      ? 'verified story published or meaningfully updated within three hours'
      : 'why-now context required; local score boosted by context; duplicate editorial families blocked';

    host.innerHTML = `
      <div class="breaking-heading">
        <strong>${label}</strong>
        ${stamp ? `<span class="breaking-status">${esc(stamp)}</span>` : ''}
      </div>
      <div class="breaking-list" data-count="${visible.length}">
        ${visible.map(item => {
          const href = storyUrl(item);
          const headline = displayHeadline(item.shortHeadline || item.headline);
          return `<a class="breaking-row" href="${esc(href)}" data-breaking-score="${esc(item.breakingScore ?? '')}" data-local-update-score="${esc(item.localUpdateScore ?? '')}" data-context-score="${esc(contextScore(item))}"${/^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : ''}><strong>${esc(headline)}</strong><span class="breaking-chevron" aria-hidden="true">›</span></a>`;
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
    const live = await fetchJson('/data/breaking-now.json');
    render(live);
  }

  load();
  setInterval(load, 60 * 1000);
})();
