import {
  canLabelMostRead,
  effectiveFreshnessTimestamp,
  popularityScore,
  relativeTime,
  selectNewest
} from '/lib/homepage-ranking.js';

(() => {
  const latestList = document.getElementById('latestList');
  const newestRail = document.querySelector('.newest');
  const pickGrid = document.getElementById('pickGrid');
  const picksTitle = document.getElementById('picksTitle');
  const lead = document.querySelector('.top-story');
  const leadGrid = document.querySelector('.lead-grid');
  const REFRESH_MS = 5 * 60 * 1000;
  const cleanDash = value => String(value || '').replace(/(\d)[—–](\d)/g, '$1-$2').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const STORY_ALIASES = {
    'burlington-hotspots-0-24': 'burlington-ultimate-team-0-24'
  };
  const publicUrl = value => {
    const raw = String(value || '');
    if (/^https?:\/\//.test(raw)) return raw;
    const story = raw.match(/^articles\/([^/]+)\.html$/);
    if (story) return `/stories/${STORY_ALIASES[story[1]] || story[1]}/`;
    const clean = raw.match(/^\/stories\/([^/]+)\/?$/);
    if (clean && STORY_ALIASES[clean[1]]) return `/stories/${STORY_ALIASES[clean[1]]}/`;
    if (raw === 'updates.html') return '/news/';
    if (raw === 'explore.html') return '/explore/';
    if (raw === 'election-guide.html' || raw.startsWith('election-guide.html')) return raw.replace('election-guide.html', '/elections/');
    if (raw === 'skyway-traffic.html') return '/traffic/';
    if (raw === 'sports.html') return '/sports/';
    if (raw === 'puzzles.html') return '/games/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  };
  const TOPIC_LABELS = {
    'public-safety': 'Public safety',
    food: 'Food',
    development: 'Development',
    history: 'History',
    election: 'Election',
    schools: 'Schools',
    events: 'Events',
    sports: 'Sports',
    nature: 'Nature',
    traffic: 'Traffic',
    transportation: 'Transportation',
    canada: 'Canada',
    burlington: 'Burlington'
  };
  const SUBJECT_PATTERNS = [
    ['data-centre', /data.?centre|3110|south service/i],
    ['school-policy', /teacher take your phone|school rules|student rights/i],
    ['school-calendar', /school starts|back to school/i],
    ['crime', /crime|police|severity index/i],
    ['local-food', /cafe|restaurant|board-game|food/i],
    ['730-brant', /730 brant/i],
    ['millcroft', /millcroft/i],
    ['skyway', /skyway|tunnels/i],
    ['election', /ward|vote|candidate|ballot|mayor/i],
    ['sports', /sports|0.24|toss bosses|hotspots|lockers/i],
    ['wildlife', /salamander|fishway|marsh|rabies/i]
  ];
  const categoryLabel = item => {
    if (item?.topic && TOPIC_LABELS[item.topic]) return TOPIC_LABELS[item.topic];
    const haystack = `${item?.label || ''} ${item?.tag || ''} ${item?.kind || ''} ${item?.headline || ''}`.toLowerCase();
    if (/election|ward|vote|candidate|ballot/.test(haystack)) return 'Election';
    if (/school|student|teacher|back to school/.test(haystack)) return 'Schools';
    if (/cafe|restaurant|food|ribfest/.test(haystack)) return 'Food';
    if (/tunnel|history/.test(haystack)) return 'History';
    if (/development|brant|building|housing|millcroft|zoning|construction|data centre/.test(haystack)) return 'Development';
    if (/traffic|qew|skyway|road|closure/.test(haystack)) return 'Traffic';
    if (/(^|[^a-z])sport|soccer|hockey|ringette|lacrosse|ultimate|golf/.test(haystack)) return 'Sports';
    if (/event|festival|weekend|concert/.test(haystack)) return 'Events';
    if (/fish|wildlife|nature|salamander|marsh|park|quarry|rabies/.test(haystack)) return 'Nature';
    if (/crime|police|safety/.test(haystack)) return 'Public safety';
    if (/canada|tariff|federal/.test(haystack)) return 'Canada';
    return item?.label || 'Burlington';
  };
  const categoryKey = item => item?.topic || categoryLabel(item).toLowerCase().replace(/\s+/g, '-');
  const subjectKeys = item => {
    const keys = new Set((item?.subjects || []).map(value => String(value).toLowerCase()));
    const haystack = `${item?.id || ''} ${item?.headline || ''} ${item?.label || ''}`;
    SUBJECT_PATTERNS.forEach(([key, pattern]) => { if (pattern.test(haystack)) keys.add(key); });
    return keys;
  };
  const appealFactor = (item, selected) => {
    const haystack = `${item?.id || ''} ${item?.headline || ''}`.toLowerCase();
    let factor = 1;
    if (/millcroft|ward-change|ward may have changed|phase-2|phase 2|zoning/.test(haystack)) factor *= 0.88;
    if (/sports-lockers|\blockers\b/.test(haystack) && !/0-24|hotspots|toss/.test(haystack)) factor *= 0.88;
    if (categoryKey(item) === 'development' && selected.some(other => categoryKey(other) === 'development')) factor *= 0.92;
    return factor;
  };
  const adjustedScore = (item, selected) => {
    let score = Number(item?.placementScore || 0) * appealFactor(item, selected);
    if (!selected.length) return score;
    const category = categoryKey(item);
    const subjects = subjectKeys(item);
    if (categoryKey(selected[selected.length - 1]) === category) score *= 0.75;
    if (selected.some(other => categoryKey(other) === category)) score *= 0.85;
    if (subjects.size && selected.some(other => [...subjects].some(key => subjectKeys(other).has(key)))) score *= 0.80;
    return score;
  };
  const diversify = (items, limit, excludeIds, prior) => {
    const exclude = new Set(excludeIds || []);
    const remaining = items.filter(item => item?.id && !exclude.has(item.id));
    const selected = [...(prior || []).filter(item => item?.id)];
    const result = [];
    while (remaining.length && result.length < limit) {
      let bestIndex = 0;
      let bestScore = -1;
      remaining.forEach((item, index) => {
        const score = adjustedScore(item, selected);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      const next = remaining.splice(bestIndex, 1)[0];
      result.push(next);
      selected.push(next);
    }
    return result;
  };

  function tightenDeck(value){
    let text = cleanDash(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const words = text.split(/\s+/);
    if (words.length <= 18 && sentences.length <= 1) return text;
    if (sentences[0] && sentences[0].split(/\s+/).length <= 18) return sentences[0];
    return `${words.slice(0, 16).join(' ').replace(/[.,;:]$/, '')}.`;
  }

  const CRIME_IMAGE = '/assets/stories/public-safety/halton-police-crime-burlington.webp';
  const CRIME_ALT = 'Halton Regional Police vehicle behind crime-scene tape.';
  const CRIME_TITLE = 'How bad is crime in Burlington, really?';
  const CRIME_DECK = 'One category of crime is moving the wrong way.';
  const SPORTS_TITLE = 'This Burlington team has lost 24 straight games. Why do they keep coming back?';
  const CAFE_TITLE = 'A Burlington gathering place closed. The problem wasn’t demand.';
  const PICK_HOOKS = {
    'burlington-crime-analysis-2026': CRIME_DECK,
    'how-bad-is-burlington-crime': CRIME_DECK,
    'e-scooter-burlington-rules': 'Most public roads and sidewalks in Burlington are still off-limits.',
    'data-centre-not-ai': 'The real debate is what 20 megawatts means beside an established neighbourhood.',
    'nostalgia-games-cafe-closure': 'The community showed up. The building problem was harder to solve.',
    'skyway-tunnels': 'The tunnel plan got much further than most Burlington residents probably realize.',
    'burlington-hotspots-0-24': 'After an 0–12 season, they changed the name. Twelve games later, they were still waiting for a win.',
    'burlington-ultimate-team-0-24': 'After an 0–12 season, they changed the name. Twelve games later, they were still waiting for a win.',
    '730-brant-vacant-building': 'The building had already been approved for redevelopment years earlier.',
    'ribfest-2026': 'The smoke lasts four days. The fundraising has lasted three decades.',
    'fishway-2025': 'The biggest number in the Fishway report is not the most important one.',
    'ontario-student-rights-school': 'What schools can take, search and keep are three different questions.'
  };

  function isCrimeItem(item){
    return /crime|burlington-crime/i.test(`${item?.id || ''} ${item?.headline || ''}`);
  }

  function isSportsStreak(item){
    return /hotspots-0-24|ultimate-team-0-24|toss bosses|0–24|0-24/i.test(`${item?.id || ''} ${item?.headline || ''}`);
  }

  function displayHeadline(item){
    if (isCrimeItem(item)) return CRIME_TITLE;
    if (isSportsStreak(item)) return SPORTS_TITLE;
    if (/nostalgia-games-cafe/i.test(item?.id || '')) return CAFE_TITLE;
    return cleanDash(item.headline);
  }

  function displayDeck(item){
    if (isCrimeItem(item)) return CRIME_DECK;
    if (PICK_HOOKS[item.id]) return PICK_HOOKS[item.id];
    return tightenDeck(item.deck || '');
  }

  function pickHook(item){
    const hook = displayDeck(item);
    const words = hook.split(/\s+/).filter(Boolean);
    if (words.length < 8 || words.length > 22) return hook && words.length ? hook : '';
    const title = displayHeadline(item).toLowerCase();
    return hook.toLowerCase() === title ? '' : hook;
  }

  function storyImage(item, fallback){
    const raw = item.image ? (item.image.startsWith('/') ? item.image : `/${item.image}`) : fallback;
    return /crime/i.test(`${item.id || ''} ${item.headline || ''}`) && /\.svg$|chart|comparison|halton-police-dusk/i.test(raw)
      ? CRIME_IMAGE
      : raw;
  }

  function localReadStats(){
    try {
      return JSON.parse(localStorage.getItem('bn-article-read-counts') || '{}');
    } catch (_) {
      return {};
    }
  }

  function renderLead(item){
    if (!lead || !item?.headline || !item?.url) return;
    const url = publicUrl(item.url);
    const external = /^https?:\/\//.test(url);
    const image = storyImage(item, '/assets/editorial/home-share.webp');
    const isCrimeHero = /halton-police-crime/.test(image);
    const alt = isCrimeHero ? CRIME_ALT : (item.alt || item.headline);
    const deck = displayDeck(item);
    lead.innerHTML = `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="top-image"><img src="${esc(image)}" alt="${esc(alt)}" fetchpriority="high"></div><div class="top-copy"><span class="kicker">${esc(categoryLabel(item))}</span><h1>${esc(displayHeadline(item))}</h1>${deck ? `<p>${esc(deck)}</p>` : ''}</div></a>`;
  }

  function hideNewest(){
    if (newestRail) {
      newestRail.hidden = true;
      newestRail.setAttribute('aria-hidden', 'true');
    }
    if (latestList) latestList.innerHTML = '';
    leadGrid?.classList.add('is-hero-only');
  }

  function renderNewest(items, heroId){
    const picked = selectNewest(items, {heroId, limit: 3});
    if (!latestList || !newestRail || !picked.items.length) {
      hideNewest();
      return [];
    }
    newestRail.hidden = false;
    newestRail.removeAttribute('aria-hidden');
    leadGrid?.classList.remove('is-hero-only');
    latestList.innerHTML = picked.items.map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const category = categoryLabel(item);
      const hook = pickHook(item);
      const stamp = relativeTime(item.lastMeaningfulUpdate || item.publishedAt || item.datePublished || item.published || item.activeFrom);
      const datetime = new Date(effectiveFreshnessTimestamp(item) || Date.now()).toISOString();
      return `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''} data-category="${esc(category)}"><span><small>${esc(category)}</small><strong>${esc(displayHeadline(item))}</strong>${hook ? `<em class="newest-hook">${esc(hook)}</em>` : ''}${stamp ? `<time datetime="${esc(datetime)}">${esc(stamp)}</time>` : ''}</span></a>`;
    }).join('');
    window.BN_NEWEST_AUDIT = picked.items.map((item, index) => ({
      position: index + 1,
      headline: displayHeadline(item),
      category: categoryLabel(item),
      publishedAt: item.publishedAt || item.datePublished || item.published || item.activeFrom,
      relative: relativeTime(item.lastMeaningfulUpdate || item.publishedAt || item.published || item.activeFrom),
      diversityChangedOrder: picked.diversityChangedOrder
    }));
    return picked.items;
  }

  function renderPicks(items, readStats){
    if (!pickGrid || !items.length) return;
    const sample = Object.values(readStats || {}).reduce((sum, row) => sum + (Number(row.opens) || 0), 0);
    if (picksTitle) picksTitle.textContent = canLabelMostRead(sample) ? 'Popular now' : 'Top picks';
    pickGrid.innerHTML = items.slice(0, 3).map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const image = storyImage(item, '/assets/editorial/home-share.webp');
      const hook = pickHook(item);
      return `<a class="pick-card" href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="pick-image"><img src="${esc(image)}" alt="${esc(item.alt || item.headline)}" loading="lazy"></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(displayHeadline(item))}</h3>${hook ? `<p class="pick-hook">${esc(hook)}</p>` : ''}</a>`;
    }).join('');
  }

  function applySurface(data){
    const hero = data.feature?.[0];
    if (hero) renderLead(hero);
    const leadId = hero?.id;
    const pool = [...(data.latest || []), ...(data.rail || []), ...(data.picks || []), ...(data.feature || [])];
    const seenFresh = new Set();
    const newestSource = pool.filter(item => item?.id && (seenFresh.has(item.id) ? false : seenFresh.add(item.id)));
    const newest = renderNewest(newestSource, leadId);
    const newestIds = (newest || []).map(item => item.id);
    const seen = new Set();
    const pickSource = [
      ...(data.picks || []),
      ...(data.feature || []).slice(1),
      ...(data.rail || []),
      ...(data.latest || [])
    ].filter(item => item?.id && (seen.has(item.id) ? false : seen.add(item.id)));
    const reads = localReadStats();
    const ranked = pickSource.map(item => {
      const stats = reads[item.id] || {};
      return {
        item,
        score: popularityScore({
          reads1h: stats.opens || 0,
          reads6h: stats.opens || 0,
          reads24h: stats.opens || 0,
          firstSeen: stats.first || Date.now(),
          lastSeen: stats.last || Date.now()
        }, item.placementScore || 0)
      };
    }).sort((a, b) => b.score - a.score);
    const picks = diversify(
      ranked.map(row => row.item),
      3,
      [leadId, ...newestIds].filter(Boolean),
      [hero, ...(newest || [])].filter(Boolean)
    );
    renderPicks(picks.length ? picks : pickSource, reads);
  }

  function loadSurface(){
    return fetch('/data/home-surface.json', {cache: 'no-store'})
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(applySurface)
      .catch(() => {});
  }

  function startRefresh(){
    let timer = 0;
    const tick = () => {
      if (document.hidden) return;
      loadSurface();
    };
    const arm = () => {
      if (timer) clearInterval(timer);
      timer = window.setInterval(tick, REFRESH_MS);
    };
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadSurface();
      arm();
    });
    arm();
  }

  hideNewest();
  loadSurface().then(startRefresh);
})();
