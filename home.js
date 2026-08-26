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
    ['local-food', /cafe|restaurant|board-game|ribfest|food/i],
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
  const adjustedScore = (item, selected) => {
    let score = Number(item?.placementScore || 0);
    if (!selected.length) return score;
    const category = categoryKey(item);
    const subjects = subjectKeys(item);
    if (categoryKey(selected[selected.length - 1]) === category) score *= 0.75;
    if (selected.some(other => categoryKey(other) === category)) score *= 0.85;
    if (subjects.size && selected.some(other => [...subjects].some(key => subjectKeys(other).has(key)))) score *= 0.80;
    return score;
  };
  const diversify = (items, limit, excludeIds) => {
    const exclude = new Set(excludeIds || []);
    const remaining = items.filter(item => item?.id && !exclude.has(item.id));
    const selected = [];
    while (remaining.length && selected.length < limit) {
      let bestIndex = 0;
      let bestScore = -1;
      remaining.forEach((item, index) => {
        const score = adjustedScore(item, selected);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      selected.push(remaining.splice(bestIndex, 1)[0]);
    }
    return selected;
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
  const CRIME_DECK = 'Halton is unusually safe, but one category of crime is moving the wrong way.';
  const PICK_HOOKS = {
    'data-centre-not-ai': 'The real question is what 20 megawatts means beside an established neighbourhood.',
    'nostalgia-games-cafe-closure': 'The community showed up. The building problem was harder to solve.',
    'skyway-tunnels': 'The plan got surprisingly far before Burlington ended up with the bridge we know.',
    'burlington-hotspots-0-24': 'The losing streak is only part of why the team keeps coming back.',
    '730-brant-vacant-building': 'It sat empty for years. Then a fire made the vacancy impossible to ignore.'
  };

  function isCrimeItem(item){
    return /crime|burlington-crime/i.test(`${item?.id || ''} ${item?.headline || ''}`);
  }

  function displayHeadline(item){
    return isCrimeItem(item) ? CRIME_TITLE : cleanDash(item.headline);
  }

  function displayDeck(item){
    if (isCrimeItem(item)) return CRIME_DECK;
    return tightenDeck(item.deck || '');
  }

  function pickHook(item){
    if (PICK_HOOKS[item.id]) return PICK_HOOKS[item.id];
    const deck = tightenDeck(item.deck || '');
    const words = deck.split(/\s+/).filter(Boolean);
    return words.length >= 8 && words.length <= 18 ? deck : '';
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
      const pickSource = Array.isArray(data.picks) && data.picks.length
        ? data.picks
        : [...(data.feature || []).slice(1), ...(data.rail || [])];
      const picks = Array.isArray(data.picks) && data.picks.length
        ? data.picks.slice(0, 3)
        : diversify(pickSource, 3, [leadId, ...newestIds].filter(Boolean));
      renderPicks(picks.length ? picks : pickSource);
    }).catch(() => {});
})();
