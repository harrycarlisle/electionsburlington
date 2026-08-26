(() => {
  const isArticle = /\/(articles|stories)\//.test(location.pathname);
  if (!isArticle) return;

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pathParts = location.pathname.replace(/\/+$/,'').split('/').filter(Boolean);
  const currentSlug = (pathParts[pathParts.length - 1] || '').replace(/\.html$/, '');
  document.body.classList.add('bn-story-page');

  const detailMap = {
    'burlington-data-centre-not-ai': [
      ['Location', '3110 South Service Rd'],
      ['Type', 'General-purpose data centre'],
      ['Electrical capacity', 'About 20 MW'],
      ['Status', 'Under City review']
    ],
    'burlington-rabies-bat-2026': [
      ['Confirmed', 'Aug. 14, 2026'],
      ['Found', 'Aug. 11 in Burlington'],
      ['Exact location', 'Not publicly disclosed'],
      ['If exposed', 'Seek care and call 311']
    ],
    'ontario-student-rights-school': [
      ['Board', 'Halton District School Board'],
      ['Grades 7–12', 'Phones stored during class'],
      ['K–6', 'Devices stored for the school day'],
      ['Searches', 'Require a school-safety reason']
    ],
    'back-to-school-2026': [
      ['First student day', 'Sept. 8, 2026'],
      ['PA days', 'Sept. 2 and 3'],
      ['Next PA day', 'Oct. 9'],
      ['Calendar', 'HDSB 2026–27']
    ],
    'upper-middle-road-construction-2026': [
      ['Corridor', 'Mountain Grove to Guelph Line'],
      ['Watermain work', 'Fall 2026 to spring 2027'],
      ['Surface work', 'Spring to summer 2027'],
      ['Traffic', 'Lane restrictions expected']
    ],
    'millcroft-phase-2-138-homes': [
      ['Proposal', '138 homes'],
      ['Detached', '73 homes'],
      ['Townhouses', '65 homes'],
      ['Status', 'Under City review']
    ],
    'nelson-quarry-tribunal-decision': [
      ['Area', 'Mount Nemo'],
      ['Decision', 'Aug. 18, 2026'],
      ['City position', 'Opposed expansion'],
      ['Next step', 'Legal and technical review']
    ],
    'ribfest-2026': [
      ['Dates', 'Sept. 4–7, 2026'],
      ['Location', 'Spencer Smith Park'],
      ['Anniversary', '30th year'],
      ['Raised historically', 'Nearly $6 million']
    ],
    'fishway-26000-fish': [
      ['2025 count', '26,503 fish'],
      ['Location', 'Cootes Paradise Fishway'],
      ['Main job', 'Keep large carp out'],
      ['Recovery issue', 'Water quality']
    ],
    'how-bad-is-burlington-crime': [
      ['2024 CSI', '31.2'],
      ['Region', 'Halton'],
      ['2025 Total crimes', '15,673'],
      ['Note', 'No Burlington-only CSI']
    ],
    'nostalgia-games-cafe-closure': [
      ['Games', '300+'],
      ['Meetup community', '1,500+ members'],
      ['Fundraiser target', '$50,000'],
      ['Status', 'Closed']
    ],
    '730-brant-vacant-building': [
      ['Address', '730 Brant Street'],
      ['Redevelopment approval', '2016'],
      ['Fire', 'February 2026'],
      ['Current ownership', 'Not yet verified']
    ],
    'salamander-road-closure': [
      ['Road', 'King Road'],
      ['Season', 'Spring migration'],
      ['Species', 'Jefferson salamander'],
      ['Status', 'Endangered in Ontario']
    ],
    'skyway-bridge-story': [
      ['First Skyway', '1958'],
      ['Twin span', '1985'],
      ['Unbuilt option', 'Three tunnels'],
      ['Properties bought', '84']
    ]
  };

  function track(name, props) {
    const event = Object.assign({
      name,
      slug: currentSlug,
      path: location.pathname,
      t: Date.now()
    }, props || {});
    try {
      const key = 'bn-article-events';
      const prev = JSON.parse(sessionStorage.getItem(key) || '[]');
      prev.push(event);
      sessionStorage.setItem(key, JSON.stringify(prev.slice(-80)));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('bn:article-event', {detail: event}));
    const endpoint = window.BN_ANALYTICS_ENDPOINT;
    if (endpoint && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], {type: 'application/json'}));
      } catch (_) {}
    }
  }
  window.BN = window.BN || {};
  window.BN.track = track;

  function lockArticleSearch() {
    const paint = () => {
      const input = document.querySelector('.header-search input,.site-search input');
      if (input && input.placeholder !== 'Search Burlington') input.placeholder = 'Search Burlington';
      const label = document.querySelector('.site-search-link span');
      if (label && label.textContent !== 'Search Burlington') label.textContent = 'Search Burlington';
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  }

  function normalizeHead() {
    const head = document.querySelector('.article-head');
    if (!head) return;
    head.querySelectorAll('.eyebrow, .kicker').forEach(node => node.classList.add('article-kicker'));
    head.querySelectorAll('.dek').forEach(node => node.classList.add('article-deck'));
    head.querySelectorAll('.byline').forEach(node => node.classList.add('article-byline'));
  }

  function heroForPath() {
    const map = {
      '730-brant-vacant-building': ['/assets/editorial/730-brant-share.webp', '730 Brant Street, Burlington News illustration', 'Burlington News illustration'],
      'back-to-school-2026': ['/assets/home/school-bus.webp', 'A yellow Ontario school bus', 'Photo credit in source story'],
      'burlington-rabies-bat-2026': ['/assets/explore/night-sky-mount-nemo.webp', 'Night sky over Burlington-area escarpment', 'Burlington News visual'],
      'fishway-26000-fish': ['/assets/home/fishway.webp', 'Cootes Paradise Fishway', 'Photo credit in source story'],
      'millcroft-phase-2-138-homes': ['/assets/explore/burlington-orientation-map.svg', 'Orientation map of Burlington', 'Burlington News map'],
      'nelson-quarry-tribunal-decision': ['/assets/explore/night-sky-mount-nemo.webp', 'Mount Nemo and the Burlington escarpment area', 'Burlington News visual'],
      'ontario-student-rights-school': ['/assets/home/school-rights.webp', 'Students arriving at an Ontario school', 'Burlington News illustration'],
      'ribfest-2026': ['/assets/home/ribs.webp', 'Barbecue ribs at a festival', 'Photo credit in source story'],
      'salamander-road-closure': ['/assets/home/salamander.webp', 'Jefferson salamander', 'Photo credit in source story'],
      'skyway-bridge-story': ['/assets/home/skyway-reader.webp', 'Burlington Bay James N. Allan Skyway', 'Photo credit in source story'],
      'upper-middle-road-construction-2026': ['/assets/explore/burlington-orientation-map.svg', 'Orientation map of Burlington', 'Burlington News map'],
      'burlington-data-centre-not-ai': ['/assets/stories/data-centre/3110-south-service-road-data-centre.webp', 'Illustrative concept and site context for the proposed data centre at 3110 South Service Road, Burlington. This is not a rendering of the final building.', 'Site context and illustrative concept for the proposed 3110 South Service Road data-centre location. This is not a rendering of the final building.'],
      'burlington-hotspots-0-24': ['/assets/sports/ultimate-waterfront.webp', 'Editorial illustration of a waterfront field sport near the Skyway', 'Burlington News illustration. This is not a photo of a Hotspots game.'],
      'how-bad-is-burlington-crime': ['/assets/editorial/halton-police-dusk.webp', 'A Halton police cruiser at dusk', 'Burlington News visual'],
      'nostalgia-games-cafe-closure': ['/assets/editorial/nostalgia-cafe-closure.svg', 'Editorial illustration of a closed board-game cafe', 'Burlington News illustration']
    };
    return map[currentSlug] || ['/assets/editorial/home-share.webp', 'Burlington News', 'Burlington News'];
  }

  function applyHeroMedia(figure, src, alt, credit) {
    let img = figure.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.loading = 'eager';
      figure.prepend(img);
    }
    img.src = src;
    img.alt = alt;
    let cap = figure.querySelector('figcaption');
    if (!cap) {
      cap = document.createElement('figcaption');
      figure.appendChild(cap);
    }
    cap.textContent = credit;
  }

  function ensureHero() {
    const main = document.querySelector('main.article');
    const head = main?.querySelector('.article-head');
    if (!main || !head) return;
    const [src, alt, credit] = heroForPath();
    let figure = main.querySelector(':scope > .article-hero, .article-hero');
    if (!figure) {
      figure = document.createElement('figure');
      figure.className = 'article-hero article-hero-generated';
      head.insertAdjacentElement('afterend', figure);
    }
    const img = figure.querySelector('img');
    const currentSrc = img?.getAttribute('src') || '';
    if (currentSlug === 'how-bad-is-burlington-crime' || !img || /halton-crime-comparison/.test(currentSrc)) {
      applyHeroMedia(figure, src, alt, credit);
    }
  }

  function ensureLayout() {
    const main = document.querySelector('main.article');
    const body = document.querySelector('.article-body');
    if (!main || !body) return null;
    let layout = body.closest('.article-layout');
    if (!layout) {
      layout = document.createElement('div');
      layout.className = 'article-layout';
      body.parentNode.insertBefore(layout, body);
      layout.appendChild(body);
    }
    return layout;
  }

  function hideGlanceChips() {
    document.querySelectorAll('.article-glance').forEach(node => node.remove());
  }

  function articleText() {
    const source = document.querySelector('.article-body');
    if (!source) return '';
    const clone = source.cloneNode(true);
    clone.querySelectorAll('.sources, .article-share-tools, .article-tip-box, .article-glance, button, script, style').forEach(node => node.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function addListen() {
    const head = document.querySelector('.article-head');
    if (!head || head.querySelector('.article-listen')) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const text = articleText();
    if (!text) return;
    const words = text.split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 180));
    const wrap = document.createElement('div');
    wrap.className = 'article-listen';
    wrap.innerHTML = `<button type="button" class="article-listen-main" data-listen-toggle aria-pressed="false"><span aria-hidden="true">▶</span><strong>Listen to this story</strong><small>${minutes} min</small></button><div class="article-listen-more" hidden><button type="button" data-listen-restart>Restart</button><label>Speed <select data-listen-rate><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label></div>`;
    const byline = head.querySelector('.article-byline, .byline');
    (byline || head.lastElementChild)?.insertAdjacentElement('afterend', wrap);
    const toggle = wrap.querySelector('[data-listen-toggle]');
    const restart = wrap.querySelector('[data-listen-restart]');
    const rate = wrap.querySelector('[data-listen-rate]');
    const more = wrap.querySelector('.article-listen-more');
    let started = false;
    const setPlaying = playing => {
      toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
      toggle.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
      toggle.querySelector('strong').textContent = playing ? 'Pause' : (started ? 'Resume' : 'Listen to this story');
    };
    const makeUtterance = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = Number(rate.value) || 1;
      u.onend = () => { started = false; setPlaying(false); toggle.querySelector('strong').textContent = 'Listen to this story'; };
      u.onerror = u.onend;
      return u;
    };
    toggle.addEventListener('click', () => {
      more.hidden = false;
      track('listen_click', {state: speechSynthesis.speaking && !speechSynthesis.paused ? 'pause' : 'play'});
      if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); setPlaying(false); return; }
      if (speechSynthesis.paused) { speechSynthesis.resume(); setPlaying(true); return; }
      speechSynthesis.cancel();
      speechSynthesis.speak(makeUtterance());
      started = true;
      setPlaying(true);
    });
    restart.addEventListener('click', () => {
      track('listen_click', {state: 'restart'});
      speechSynthesis.cancel();
      speechSynthesis.speak(makeUtterance());
      started = true;
      more.hidden = false;
      setPlaying(true);
    });
    rate.addEventListener('change', () => {
      if (started || speechSynthesis.speaking || speechSynthesis.paused) {
        speechSynthesis.cancel();
        speechSynthesis.speak(makeUtterance());
        started = true;
        setPlaying(true);
      }
    });
    addEventListener('beforeunload', () => speechSynthesis.cancel(), {once: true});
  }

  function storyTokens(item) {
    return `${item.label || ''} ${item.kind || ''} ${item.headline || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3);
  }

  async function addRelated() {
    if (document.querySelector('.article-related')) return;
    let payload;
    try {
      const response = await fetch('/data/story-catalog.json', {cache: 'no-store'});
      if (!response.ok) return;
      payload = await response.json();
    } catch (_) { return; }
    const currentTitle = (document.querySelector('.article-head h1')?.textContent || '').toLowerCase();
    const currentKicker = (document.querySelector('.article-kicker, .eyebrow, .article-head .kicker')?.textContent || '').toLowerCase();
    const currentWords = new Set(`${currentKicker} ${currentTitle}`.split(/[^a-z0-9]+/).filter(word => word.length > 3));
    const items = (payload.items || []).filter(item => {
      const url = String(item.url || '');
      if (!url || url.startsWith('http')) return false;
      const slug = url.replace(/^articles\/(?:auto\/)?/, '').replace(/\.html$/, '').replace(/^.*\//, '');
      return slug && slug !== currentSlug;
    });
    items.forEach(item => {
      const overlap = storyTokens(item).filter(word => currentWords.has(word)).length;
      const published = Date.parse(item.published || item.activeFrom || '') || 0;
      item.__related = overlap * 20 + (Number(item.signals?.interest || item.signals?.novelty || 3) * 5) + (published ? published / 1e13 : 0) + (item.image ? 8 : 0);
    });
    items.sort((a, b) => b.__related - a.__related);
    const picks = items.slice(0, 3);
    if (!picks.length) return;
    const section = document.createElement('section');
    section.className = 'article-related';
    const storyUrl = item => String(item.url || '').replace(/^articles\/(.+)\.html$/, '/stories/$1/').replace(/^(?!https?:|\/)/, '/');
    section.innerHTML = `<div class="article-related-head"><h2>You might also like</h2><a href="/news/">All stories →</a></div><div class="article-related-grid">${picks.map(item => `<a class="article-related-card" href="${esc(storyUrl(item))}"><img src="/${esc(item.image || 'assets/editorial/home-share.webp')}" alt="${esc(item.alt || item.headline || 'Burlington News')}" loading="lazy"><span>${esc(item.label || 'Burlington')}</span><strong>${esc(item.headline)}</strong></a>`).join('')}</div>`;
    section.addEventListener('click', event => {
      const card = event.target.closest('.article-related-card');
      if (card) track('related_click', {href: card.getAttribute('href') || ''});
    });
    document.querySelector('main.article')?.appendChild(section);
  }

  function hideSources() {
    document.querySelectorAll('.article-body .sources, main.article section.sources').forEach(node => {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
    });
  }

  function bindShareButtons(root) {
    const copy = root.querySelector('[data-copy-link]');
    const share = root.querySelector('[data-share-end], [data-share-link]');
    const url = () => location.href.split('#')[0];
    if (copy) {
      copy.addEventListener('click', async () => {
        track('copy_click');
        try {
          await navigator.clipboard.writeText(url());
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy link'; }, 1400);
        } catch (_) {
          const t = document.createElement('textarea');
          t.value = url();
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          t.remove();
          copy.textContent = 'Copied';
          setTimeout(() => { copy.textContent = 'Copy link'; }, 1400);
        }
      });
    }
    if (share) {
      if (!navigator.share) share.hidden = true;
      else share.addEventListener('click', () => {
        track('share_click');
        navigator.share({
          title: document.title,
          text: document.querySelector('meta[name="description"]')?.content || '',
          url: url()
        }).catch(() => {});
      });
    }
  }

  function addEndCopy() {
    const body = document.querySelector('.article-body');
    if (!body || document.querySelector('.article-share-end')) return;
    const wrap = document.createElement('div');
    wrap.className = 'article-share-tools article-share-end';
    wrap.innerHTML = '<button type="button" data-copy-link>Copy link</button><button type="button" data-share-end>Share</button>';
    body.appendChild(wrap);
    bindShareButtons(wrap);
  }

  function addReadTime() {
    const byline = document.querySelector('.article-byline, .byline');
    if (!byline) return;
    const existing = [...byline.querySelectorAll('span')].find(node => /\b\d+[- ]minute read\b|\b\d+ min read\b/i.test(node.textContent));
    const words = articleText().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 220));
    const label = `${minutes} min read`;
    if (existing) {
      existing.dataset.readTime = '1';
      existing.textContent = label;
      return;
    }
    if (byline.querySelector('[data-read-time]')) return;
    const stamp = document.createElement('span');
    stamp.dataset.readTime = '1';
    stamp.textContent = label;
    byline.appendChild(stamp);
  }

  function cleanArticleCopy() {
    const root = document.querySelector('.article-body, .article-head');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!node.nodeValue || !node.nodeValue.trim()) return;
      const next = node.nodeValue
        .replace(/[ \t]+([.,;:!?])/g, '$1')
        .replace(/([.!?])[ \t]{2,}/g, '$1 ')
        .replace(/[ \t]{2,}/g, ' ');
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function addScrollTracking() {
    const marks = {25: false, 50: false, 75: false, 100: false};
    const measure = () => {
      const el = document.querySelector('main.article');
      if (!el) return;
      const total = Math.max(1, el.offsetHeight - innerHeight);
      const scrolled = Math.min(100, Math.max(0, ((scrollY - (el.offsetTop || 0)) / total) * 100));
      [25, 50, 75, 100].forEach(depth => {
        if (!marks[depth] && scrolled >= depth) {
          marks[depth] = true;
          track('scroll_depth', {depth});
        }
      });
    };
    addEventListener('scroll', measure, {passive: true});
    measure();
  }

  function addSchema() {
    if (document.getElementById('articleStructuredData')) return;
    const title = document.querySelector('.article-head h1')?.textContent?.trim() || document.title;
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const image = document.querySelector('.article-hero img')?.src || 'https://burlingtonnews.ca/assets/editorial/home-share.webp';
    const ld = document.createElement('script');
    ld.id = 'articleStructuredData';
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: title,
      description,
      image: [image],
      author: {'@type': 'Organization', name: 'Burlington News'},
      publisher: {'@type': 'NewsMediaOrganization', name: 'Burlington News', logo: {'@type': 'ImageObject', url: 'https://burlingtonnews.ca/logo-mark.png'}},
      mainEntityOfPage: location.href.split('#')[0]
    });
    document.head.appendChild(ld);
  }

  function normalizeArticleMeta() {
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const title = document.querySelector('.article-head h1')?.textContent?.trim() || document.title.replace(/\s*\|\s*Burlington News.*/, '');
    const hero = document.querySelector('.article-hero img');
    const image = hero?.src || 'https://burlingtonnews.ca/assets/editorial/home-share.webp';
    const canonical = document.querySelector('link[rel="canonical"]');
    const storyPath = currentSlug ? `/stories/${currentSlug}/` : location.pathname;
    if (canonical) canonical.href = `https://burlingtonnews.ca${storyPath}`;
    const url = (canonical?.href) || location.href.split('#')[0];
    const metas = [
      ['property', 'og:site_name', 'Burlington News'],
      ['property', 'og:type', 'article'],
      ['property', 'og:title', title],
      ['property', 'og:description', description],
      ['property', 'og:url', url],
      ['property', 'og:image', image],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:title', title],
      ['name', 'twitter:description', description],
      ['name', 'twitter:image', image]
    ];
    metas.forEach(([attr, key, value]) => {
      let node = document.querySelector(`meta[${attr}="${key}"]`);
      if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attr, key);
        document.head.appendChild(node);
      }
      node.content = value;
    });
  }

  function boot() {
    lockArticleSearch();
    normalizeHead();
    ensureHero();
    ensureLayout();
    hideSources();
    cleanArticleCopy();
    addReadTime();
    addListen();
    hideGlanceChips();
    addEndCopy();
    normalizeArticleMeta();
    addSchema();
    document.querySelectorAll('.article-aside, .article-detail-rail, .article-tip-box, .article-share-tools:not(.article-share-end)').forEach(node => node.classList.add('article-aside-legacy'));
    addRelated();
    addScrollTracking();
    track('page_view');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
