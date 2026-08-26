(() => {
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const INNER_PLACEHOLDER = 'Search Burlington';
  const HOME_PROMPTS = [
    'Search “Date night”',
    'Search “This weekend”',
    'Search “Best food”',
    'Search “Best tacos”',
    'Search “I’m bored”'
  ];
  const index = [
    {title:'How bad is Burlington’s crime, really?',url:'/stories/how-bad-is-burlington-crime/',section:'Public safety',keywords:'crime police safety statistics canada halton'},
    {title:'Burlington’s board-game cafe closed',url:'/stories/nostalgia-games-cafe-closure/',section:'Local business',keywords:'nostalgia games cafe board game occupancy'},
    {title:'Ontario nearly replaced the Skyway with three tunnels',url:'/stories/skyway-bridge-story/',section:'Feature',keywords:'skyway bridge canal qew tunnels'},
    {title:'Burlington’s proposed data centre is not what many people think',url:'/stories/burlington-data-centre-not-ai/',section:'Development',keywords:'data centre ai south service road'},
    {title:'Millcroft Phase 2 proposes 138 homes',url:'/stories/millcroft-phase-2-138-homes/',section:'Development',keywords:'millcroft golf course homes development ward 6'},
    {title:'What the Nelson Quarry decision means for Burlington',url:'/stories/nelson-quarry-tribunal-decision/',section:'Development',keywords:'nelson quarry mount nemo escarpment olt'},
    {title:'Upper Middle Road construction: what changes next',url:'/stories/upper-middle-road-construction-2026/',section:'Roads',keywords:'upper middle road watermain construction guelph line'},
    {title:'A bat in Burlington tested positive for rabies',url:'/stories/burlington-rabies-bat-2026/',section:'Public health',keywords:'rabies bat halton public health'},
    {title:'Ribfest turns 30',url:'/stories/ribfest-2026/',section:'Events',keywords:'ribfest ribs labour day food festival'},
    {title:'The school dates Burlington families need',url:'/stories/back-to-school-2026/',section:'Schools',keywords:'school calendar hdsb September'},
    {title:'What Ontario students can actually be searched for',url:'/stories/ontario-student-rights-school/',section:'Schools',keywords:'teacher phone detention bag locker search student rights school'},
    {title:'730 Brant sat empty for more than a decade, then caught fire',url:'/stories/730-brant-vacant-building/',section:'Development',keywords:'abandoned vacant building fire Brant Street owner redevelopment'},
    {title:'Explore Burlington',url:'/explore/',section:'Explore',keywords:'this weekend bored passport calendar places free farmers market date night things to do'},
    {title:'Burlington food spots worth trying',url:'/guides/burlington-food-spots.html',section:'Food',keywords:'best food tacos burger sandwich banh mi coffee restaurants'},
    {title:'Burlington 2026 Election Guide',url:'/elections/',section:'Election',keywords:'vote mayor candidates ward ballot'},
    {title:'A Burlington team just went 0–24',url:'/stories/burlington-hotspots-0-24/',section:'Sports',keywords:'hotspots ultimate 0-24 burlington ultimate club'},
    {title:'Burlington sports',url:'/sports/',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette golf'},
    {title:'Puzzles about Burlington',url:'/games/',section:'Puzzles',keywords:'quiz puzzle trivia swipe games'},
    {title:'Live Burlington traffic cameras',url:'/traffic/',section:'Traffic',keywords:'qew skyway traffic camera commute brant guelph walkers appleby burloak'}
  ];
  const homeSuggested = ['I’m bored','Best tacos','This weekend','Things to do'];
  const innerSuggested = ['Skyway','Events','Food','Election'];

  function isHomepage() {
    const path = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
    return path === '/';
  }

  function intentHref(query) {
    const q = normalize(query);
    if (!q) return '';
    if (/^(i m bored|im bored|bored)$/.test(q)) return '/explore/#bored';
    if (/^(this weekend|things to do|what s happening|whats happening|date night|free things to do)$/.test(q)) return '/explore/';
    if (/^(best tacos|best food)$/.test(q)) return '/guides/burlington-food-spots.html';
    return '';
  }

  function queryFromPrompt(prompt) {
    return String(prompt || '').replace(/^Search\s+[“"]?|[”"]$/g, '').trim();
  }

  function ranked(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return index.slice(0,7);
    return index.map(item => {
      const title = normalize(item.title);
      const text = normalize(`${item.section} ${item.keywords}`);
      const score = terms.reduce((sum,term) => sum + (title.includes(term) ? 30 : 0) + (text.includes(term) ? 10 : 0),0);
      return {item,score};
    }).filter(result => result.score).sort((a,b) => b.score - a.score).map(result => result.item);
  }

  function install(form, options={}) {
    if (!form) return;
    const input = form.querySelector('input[type="search"], input');
    const popover = form.querySelector('.search-popover');
    const results = form.querySelector('.search-results');
    const suggestions = form.querySelector('.search-suggestions');
    if (!input || !popover || !results) return;

    const homepage = options.homepage ?? isHomepage();
    const prompts = options.prompts || HOME_PROMPTS;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotating = homepage && options.rotate !== false;
    const chips = homepage ? homeSuggested : innerSuggested;
    let promptIndex = 0;
    let timer = 0;
    let fading = false;
    let overlay = form.querySelector('.search-prompt-fade');

    input.placeholder = homepage ? prompts[0] : INNER_PLACEHOLDER;
    form.classList.toggle('is-home-search', homepage);
    form.classList.toggle('is-inner-search', !homepage);
    if (suggestions) suggestions.innerHTML = chips.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');

    if (rotating) {
      if (!overlay) {
        overlay = document.createElement('span');
        overlay.className = 'search-prompt-fade';
        overlay.setAttribute('aria-hidden', 'true');
        form.insertBefore(overlay, form.querySelector('svg'));
      }
      overlay.textContent = prompts[0];
      input.placeholder = '';
      input.setAttribute('aria-label', 'Search Burlington News');
    } else if (overlay) {
      overlay.remove();
      overlay = null;
    }

    function currentPrompt() {
      return prompts[promptIndex % prompts.length];
    }

    function showOverlay() {
      if (!overlay) return;
      overlay.hidden = false;
      overlay.classList.toggle('is-hidden', false);
      input.placeholder = '';
    }

    function hideOverlay() {
      if (!overlay) return;
      overlay.classList.add('is-hidden');
      overlay.hidden = true;
    }

    function canRotate() {
      return rotating && document.activeElement !== input && !input.value && !fading;
    }

    function applyPrompt(text, animate) {
      if (!overlay) {
        input.placeholder = text;
        return;
      }
      if (!animate || reduceMotion) {
        overlay.textContent = text;
        if (canRotate() || overlay.hidden === false) showOverlay();
        return;
      }
      fading = true;
      overlay.classList.add('is-hidden');
      window.setTimeout(() => {
        overlay.textContent = text;
        if (document.activeElement !== input && !input.value) {
          overlay.hidden = false;
          overlay.classList.remove('is-hidden');
        }
        fading = false;
      }, 280);
    }

    function rotate() {
      if (!canRotate()) return;
      promptIndex += 1;
      applyPrompt(currentPrompt(), true);
    }

    function startRotation() {
      if (!rotating || timer) return;
      timer = window.setInterval(rotate, 5000);
    }

    function stopRotation() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = 0;
    }

    function render(query) {
      const matches = ranked(query);
      const intent = intentHref(query);
      const extra = intent && !matches.some(item => item.url === intent.replace(/#.*$/, ''))
        ? [{title:'Explore Burlington',url:intent,section:'Explore'}]
        : [];
      const list = extra.concat(matches);
      results.innerHTML = list.length ? list.slice(0,7).map(item => `<a role="option" href="${esc(item.url)}"><span>${esc(item.section)}</span><strong>${esc(item.title)}</strong></a>`).join('') : '<p>No exact match. Try “Skyway,” “events” or “food.”</p>';
      popover.hidden = false;
      input.setAttribute('aria-expanded','true');
    }

    function goIntentOrFirst(query) {
      const href = intentHref(query);
      if (href) {
        location.href = href;
        return true;
      }
      const first = results.querySelector('a');
      if (first) {
        location.href = first.href;
        return true;
      }
      return false;
    }

    suggestions?.addEventListener('click', event => {
      const button = event.target.closest('[data-search]');
      if (!button) return;
      const term = button.dataset.search;
      if (intentHref(term)) {
        location.href = intentHref(term);
        return;
      }
      input.value = term;
      hideOverlay();
      render(input.value);
    });
    input.addEventListener('focus', () => {
      stopRotation();
      hideOverlay();
      if (!input.value && homepage) input.placeholder = queryFromPrompt(currentPrompt()) ? currentPrompt() : INNER_PLACEHOLDER;
      if (!input.value && !homepage) input.placeholder = INNER_PLACEHOLDER;
      render(input.value);
    });
    input.addEventListener('input', () => {
      stopRotation();
      hideOverlay();
      render(input.value);
    });
    input.addEventListener('blur', () => {
      if (input.value) return;
      if (homepage && rotating) {
        input.placeholder = '';
        applyPrompt(currentPrompt(), false);
        startRotation();
      } else {
        input.placeholder = INNER_PLACEHOLDER;
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (goIntentOrFirst(input.value || queryFromPrompt(currentPrompt()))) return;
      render(input.value);
    });
    document.addEventListener('click', event => {
      if (!form.contains(event.target)) {
        popover.hidden = true;
        input.setAttribute('aria-expanded','false');
      }
    });

    if (rotating) startRotation();
    if (new URLSearchParams(location.search).get('search') === '1') {
      requestAnimationFrame(() => { input.focus(); render(''); history.replaceState(null,'',location.pathname); });
    }
  }

  window.BurlingtonSearch = { install, ranked, index, intentHref, HOME_PROMPTS, INNER_PLACEHOLDER };
})();
