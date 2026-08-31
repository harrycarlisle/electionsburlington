(() => {
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const INNER_PLACEHOLDER = 'Search anything...';
  const MIN_CHARS = 2;
  const HOME_PROMPTS = [
    'Search “Date night”',
    'Search “This weekend”',
    'Search “Best food”',
    'Search “Best tacos”',
    'Search “I’m bored”'
  ];
  const DRAWER_PROMPTS = [
    'Search “Best food”',
    'Search “This weekend”',
    'Search “What to do”',
    'Search “Next event”',
    'Search “Election”',
    'Search “Road closures”',
    'Search “Schools”',
    'Search “Crime”',
    'Search “Things to do”'
  ];
  const index = [
    {title:'Burlington has spent more than $90 million on stormwater since 2015. What changed?',url:'/stories/burlington-flood-protection-90-million/',section:'Infrastructure',keywords:'flood flooding stormwater tuck creek new street spruce regal lower rambo basement flood protection 2014'},
    {title:'Two Burlington roads will stay fully closed into September. Here is where',url:'/stories/burlington-road-closures-september-2026/',section:'Roads',keywords:'road closures spruce avenue shoreacres goodram britannia walkers guelph line detour construction september'},
    {title:'Oakville approved a 1,000-space Costco near Burloak. Here is how drivers will get in',url:'/stories/costco-burloak-wyecroft/',section:'Development',keywords:'costco oakville burloak wyecroft riocan parking gas bar traffic warehouse'},
    {title:'Up to 90% of a building can now be made inside this Burlington factory',url:'/stories/sekisui-burlington-modular-factory/',section:'Made in Burlington',keywords:'sekisui modular factory manufacturing housing schools maple avenue building construction'},
    {title:'How bad is crime in Burlington, really?',url:'/stories/how-bad-is-burlington-crime/',section:'Public safety',keywords:'crime police safety statistics canada halton'},
    {title:'E-scooter injuries are rising. Burlington’s rules are stricter than you might think.',url:'/stories/e-scooter-burlington-rules/',section:'Transportation',keywords:'e-scooter scooter centennial trail scooty safety helmet'},
    {title:'A Burlington gathering place closed. The problem wasn’t demand.',url:'/stories/nostalgia-games-cafe-closure/',section:'Local business',keywords:'nostalgia games cafe board game occupancy candy'},
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
    {title:'Burlington Farmers Market',url:'/events/burlington-farmers-market/',section:'Events',keywords:'farmers market lions club wednesday friday saturday evening burlington centre'},
    {title:'Burlington food passport',url:'/food-passport/',section:'Food',keywords:'best food tacos burger sandwich banh mi coffee restaurants passport'},
    {title:'Burlington 2026 Election Guide',url:'/elections/',section:'Election',keywords:'vote mayor candidates ward ballot'},
    {title:'This Burlington team is 0–24. Why do they keep coming back?',url:'/stories/burlington-ultimate-team-0-24/',section:'Sports',keywords:'toss bosses panic at the disco ultimate 0-24 burlington ultimate club'},
    {title:'Burlington sports',url:'/sports/',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette golf'},
    {title:'Puzzles about Burlington',url:'/games/',section:'Puzzles',keywords:'quiz puzzle trivia swipe games'},
    {title:'Give feedback',url:'/feedback/',section:'About',keywords:'correction error accessibility feedback'},
    {title:'Work with Burlington News',url:'/work-with-us/',section:'About',keywords:'partner sponsor expertise pitch advertising story tip source community work with us'},
    {title:'Live Burlington traffic cameras',url:'/traffic/',section:'Traffic',keywords:'qew skyway traffic camera commute brant guelph walkers appleby burloak'},
    {title:'Compare the 2026 mayoral candidates',url:'/elections/compare/',section:'Election',keywords:'mayor compare taxes housing development traffic meed ward kearns nisan'},
    {title:'What ward am I in?',url:'/elections/ward/',section:'Election',keywords:'ward map finder councillor trustee ballot'},
    {title:'Burlington GO to Union',url:'/go/burlington-to-union/',section:'GO',keywords:'go train union lakeshore west next train delay'},
    {title:'Which GO station should I use?',url:'/go/which-station/',section:'GO',keywords:'aldershot burlington appleby parking transit'},
    {title:'What is being built in Burlington?',url:'/development/',section:'Development',keywords:'data centre 1200 king millcroft old lakeshore mtsa'},
    {title:'Why did my Burlington tax bill change?',url:'/taxes/',section:'Taxes',keywords:'property tax city region education 2026'},
    {title:'Can I park here tonight?',url:'/parking/',section:'Parking',keywords:'overnight downtown snow event exemption'},
    {title:'Can I swim at Burlington Beach today?',url:'/beach/',section:'Beach',keywords:'beachway brant street swim e coli sample'},
    {title:'Things to do this weekend',url:'/explore/weekend/',section:'Explore',keywords:'weekend events ribfest market date night'},
    {title:'Food in this weekend’s Burlington plan',url:'/explore/weekend/?plan=1#eat',section:'Explore',keywords:'restaurants food dinner tonight where to eat weekend plan'}
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
    if (/^(this weekend|things to do|what s happening|whats happening|date night|free things to do|what to do|next event)$/.test(q)) return '/explore/weekend/';
    if (/^(where to eat|dinner tonight|food this weekend)$/.test(q)) return '/explore/weekend/?plan=1#eat';
    if (/^(best tacos|best food|food passport)$/.test(q)) return '/food-passport/';
    if (/^(election|elections|mayor|compare candidates)$/.test(q)) return '/elections/compare/';
    if (/^(ward|what ward)$/.test(q)) return '/elections/ward/';
    if (/^(go|next train|union)$/.test(q)) return '/go/burlington-to-union/';
    if (/^(road closures|traffic|qew)$/.test(q)) return '/traffic/?destination=toronto';
    if (/^(parking|overnight parking)$/.test(q)) return '/parking/';
    if (/^(beach|swim)$/.test(q)) return '/beach/';
    if (/^(tax|taxes|property tax)$/.test(q)) return '/taxes/';
    if (/^(development|being built)$/.test(q)) return '/development/';
    if (/^(schools|school)$/.test(q)) return '/stories/back-to-school-2026/';
    if (/^(crime)$/.test(q)) return '/stories/how-bad-is-burlington-crime/';
    return '';
  }

  function queryFromPrompt(prompt) {
    return String(prompt || '').replace(/^Search\s+[“"]?|[”"]$/g, '').trim();
  }

  function ranked(query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.map(item => {
      const title = normalize(item.title);
      const text = normalize(`${item.section} ${item.keywords}`);
      const score = terms.reduce((sum,term) => sum + (title.includes(term) ? 30 : 0) + (text.includes(term) ? 10 : 0),0);
      return {item,score};
    }).filter(result => result.score).sort((a,b) => b.score - a.score).map(result => result.item);
  }

  function install(form, options={}) {
    if (!form || form.dataset.searchReady === 'true') return;
    const input = form.querySelector('input[type="search"], input');
    const popover = form.querySelector('.search-popover');
    const results = form.querySelector('.search-results');
    const suggestions = form.querySelector('.search-suggestions');
    if (!input || !popover || !results) return;
    form.dataset.searchReady = 'true';

    const homepage = options.homepage ?? isHomepage();
    const drawer = Boolean(options.drawer || form.hasAttribute('data-drawer-search'));
    const prompts = options.prompts || (drawer ? DRAWER_PROMPTS : HOME_PROMPTS);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotating = options.rotate !== false && !reduceMotion;
    const placeholder = options.placeholder || (rotating ? prompts[0] : INNER_PLACEHOLDER);
    const chips = drawer ? [] : (homepage ? homeSuggested : innerSuggested);
    let promptIndex = 0;
    let timer = 0;
    let fading = false;
    let overlay = form.querySelector('.search-prompt-fade');

    input.placeholder = placeholder;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    form.classList.toggle('is-home-search', homepage && !drawer);
    form.classList.toggle('is-inner-search', !homepage || drawer);
    form.classList.toggle('is-drawer-search', drawer);
    if (suggestions) {
      suggestions.hidden = !chips.length;
      suggestions.innerHTML = chips.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');
    }

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

    function hideResults() {
      results.innerHTML = '';
      popover.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function render(query) {
      const q = String(query || '').trim();
      if (q.length < MIN_CHARS) {
        hideResults();
        return;
      }
      const matches = ranked(q);
      const intent = intentHref(q);
      const extra = intent && !matches.some(item => item.url === intent.replace(/#.*$/, ''))
        ? [{title:'Open this search',url:intent,section:'Go'}]
        : [];
      const list = extra.concat(matches);
      results.innerHTML = list.length
        ? list.slice(0,7).map(item => `<a role="option" href="${esc(item.url)}"><span>${esc(item.section)}</span><strong>${esc(item.title)}</strong></a>`).join('')
        : '<p>No exact match. Try “Skyway,” “events” or “food.”</p>';
      popover.hidden = false;
      input.setAttribute('aria-expanded','true');
    }

    function goIntentOrFirst(query) {
      const q = String(query || '').trim();
      if (q.length < MIN_CHARS) return false;
      const href = intentHref(q);
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
      if (!input.value) input.placeholder = rotating ? currentPrompt() : INNER_PLACEHOLDER;
      if (input.value.trim().length >= MIN_CHARS) render(input.value);
      else hideResults();
    });
    input.addEventListener('input', () => {
      stopRotation();
      hideOverlay();
      if (input.value) input.placeholder = INNER_PLACEHOLDER;
      render(input.value);
    });
    input.addEventListener('blur', () => {
      if (input.value) return;
      hideResults();
      if (rotating) {
        input.placeholder = '';
        applyPrompt(currentPrompt(), false);
        startRotation();
      } else {
        input.placeholder = INNER_PLACEHOLDER;
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const query = input.value.trim();
      if (query.length < MIN_CHARS) {
        hideResults();
        return;
      }
      render(query);
      if (goIntentOrFirst(query)) return;
    });
    document.addEventListener('click', event => {
      if (!form.contains(event.target)) {
        popover.hidden = true;
        input.setAttribute('aria-expanded','false');
      }
    });

    if (rotating) startRotation();
    if (new URLSearchParams(location.search).get('search') === '1') {
      requestAnimationFrame(() => { input.focus(); });
    }
  }

  window.BurlingtonSearch = { install, ranked, index, intentHref, HOME_PROMPTS, DRAWER_PROMPTS, INNER_PLACEHOLDER, MIN_CHARS };
})();
