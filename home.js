(() => {
  const latestList = document.getElementById('latestList');
  const pickGrid = document.getElementById('pickGrid');
  const lead = document.querySelector('.top-story');
  const cleanDash = value => String(value || '').replace(/(\d)[—–](\d)/g, '$1-$2').replace(/[—–]/g, ',').replace(/\s+,/g, ',');
  const esc = value => cleanDash(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const publicUrl = value => {
    const raw = String(value || '');
    if (/^https?:\/\//.test(raw)) return raw;
    const story = raw.match(/^articles\/([^/]+)\.html$/);
    if (story) return `/stories/${story[1]}/`;
    if (raw === 'updates.html') return '/news/';
    if (raw === 'explore.html') return '/explore/';
    if (raw === 'election-guide.html' || raw.startsWith('election-guide.html')) return raw.replace('election-guide.html', '/elections/');
    if (raw === 'skyway-traffic.html') return '/traffic/';
    if (raw === 'sports.html') return '/sports/';
    if (raw === 'puzzles.html') return '/games/';
    return raw.startsWith('/') ? raw : `/${raw}`;
  };
  const relativeDate = value => {
    const date = new Date(value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-04:00` : value);
    if (!Number.isFinite(date.getTime())) return 'Recently added';
    const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
    if (hours < 1) return 'Less than an hour ago';
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
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
    if (/sport|soccer|hockey|ringette|lacrosse|ultimate|golf/.test(haystack)) return 'Sports';
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
  const CRIME_DECK = 'Halton is unusually safe, but one category is moving the wrong way.';
  const SPORTS_TITLE = 'This Burlington team has lost 24 straight games. Why do they keep coming back?';
  const PICK_HOOKS = {
    'burlington-crime-analysis-2026': CRIME_DECK,
    'data-centre-not-ai': 'The real debate is what 20 megawatts means beside an established neighbourhood.',
    'nostalgia-games-cafe-closure': 'The community showed up. The building problem was harder to solve.',
    'skyway-tunnels': 'The tunnel plan got much further than most Burlington residents probably realize.',
    'burlington-hotspots-0-24': 'After an 0–12 season, they changed the name. Twelve games later, they were still waiting for a win.',
    'burlington-ultimate-team-0-24': 'After an 0–12 season, they changed the name. Twelve games later, they were still waiting for a win.',
    '730-brant-vacant-building': 'The building had already been approved for redevelopment years earlier.',
    'ribfest-2026': 'The smoke lasts four days. The fundraising has lasted three decades.',
    'fishway-2025': 'The biggest number in the Fishway report is not the most important one.'
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
    return cleanDash(item.headline);
  }

  function displayDeck(item){
    if (isCrimeItem(item)) return CRIME_DECK;
    if (PICK_HOOKS[item.id]) return PICK_HOOKS[item.id];
    return tightenDeck(item.deck || '');
  }

  function pickHook(item){
    if (isCrimeItem(item)) return CRIME_DECK;
    if (PICK_HOOKS[item.id]) return PICK_HOOKS[item.id];
    const deck = tightenDeck(item.deck || '');
    const words = deck.split(/\s+/).filter(Boolean);
    if (words.length < 8 || words.length > 18) return '';
    const title = displayHeadline(item).toLowerCase();
    return deck.toLowerCase() === title ? '' : deck;
  }

  function storyImage(item, fallback){
    const raw = item.image ? (item.image.startsWith('/') ? item.image : `/${item.image}`) : fallback;
    return /crime/i.test(`${item.id || ''} ${item.headline || ''}`) && /\.svg$|chart|comparison|halton-police-dusk/i.test(raw)
      ? CRIME_IMAGE
      : raw;
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

  function renderNewest(items, heroId){
    if (!latestList || !items.length) return;
    const rows = items.filter(item => item?.id && item.id !== heroId).slice(0, 3);
    latestList.innerHTML = rows.map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const category = categoryLabel(item);
      return `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''} data-category="${esc(category)}"><span><small>${esc(category)}</small><strong>${esc(displayHeadline(item))}</strong><time>${esc(relativeDate(item.published || item.activeFrom))}</time></span></a>`;
    }).join('');
    return rows;
  }

  function renderPicks(items){
    if (!pickGrid || !items.length) return;
    pickGrid.innerHTML = items.slice(0, 3).map(item => {
      const url = publicUrl(item.url);
      const external = /^https?:\/\//.test(url);
      const image = storyImage(item, '/assets/editorial/home-share.webp');
      const hook = pickHook(item);
      return `<a class="pick-card" href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="pick-image"><img src="${esc(image)}" alt="${esc(item.alt || item.headline)}" loading="lazy"></div><span class="kicker">${esc(categoryLabel(item))}</span><h3>${esc(displayHeadline(item))}</h3>${hook ? `<p class="pick-hook">${esc(hook)}</p>` : ''}</a>`;
    }).join('');
  }

  fetch('/data/home-surface.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      const hero = data.feature?.[0];
      if (hero) renderLead(hero);
      const leadId = hero?.id;
      const newest = Array.isArray(data.latest) && data.latest.length ? renderNewest(data.latest, leadId) : [];
      const newestIds = (newest || []).map(item => item.id);
      const seen = new Set();
      const pickSource = [
        ...(data.picks || []),
        ...(data.feature || []).slice(1),
        ...(data.rail || []),
        ...(data.latest || [])
      ].filter(item => item?.id && (seen.has(item.id) ? false : seen.add(item.id)));
      const picks = diversify(
        pickSource,
        3,
        [leadId, ...newestIds].filter(Boolean),
        [hero, ...(newest || [])].filter(Boolean)
      );
      renderPicks(picks.length ? picks : pickSource);
    }).catch(() => {});
})();
