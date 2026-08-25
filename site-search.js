(() => {
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
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
    {title:'Explore Burlington',url:'/explore/',section:'Explore',keywords:'this weekend bored passport calendar places free farmers market'},
    {title:'Burlington food spots worth trying',url:'/guides/burlington-food-spots.html',section:'Food',keywords:'best food tacos burger sandwich banh mi coffee restaurants'},
    {title:'Burlington 2026 Election Guide',url:'/elections/',section:'Election',keywords:'vote mayor candidates ward ballot'},
    {title:'Burlington sports',url:'/sports/',section:'Sports',keywords:'soccer hockey lacrosse ultimate ringette golf'},
    {title:'Games about Burlington',url:'/games/',section:'Games',keywords:'quiz puzzle trivia swipe'},
    {title:'Live Burlington traffic cameras',url:'/traffic/',section:'Traffic',keywords:'qew skyway traffic camera commute brant guelph walkers appleby burloak'}
  ];
  const suggested = ['This Weekend','I’m bored','Best Food','Best Tacos'];

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
    const isArticle = /\/(articles|stories)\//.test(location.pathname);
    const rotating = options.rotate && !isArticle && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prompts = options.prompts || ['Search “I’m bored”','Search “Best food”','Search “This weekend”','Search “Election”'];
    if (isArticle) input.placeholder = 'Search Burlington';
    if (suggestions) suggestions.innerHTML = suggested.map(term => `<button type="button" data-search="${esc(term)}">${esc(term)}</button>`).join('');
    function render(query) {
      const matches = ranked(query);
      results.innerHTML = matches.length ? matches.slice(0,7).map(item => `<a role="option" href="${esc(item.url)}"><span>${esc(item.section)}</span><strong>${esc(item.title)}</strong></a>`).join('') : '<p>No exact match. Try “Skyway,” “events” or “food.”</p>';
      popover.hidden = false;
      input.setAttribute('aria-expanded','true');
    }
    suggestions?.addEventListener('click', event => {
      const button = event.target.closest('[data-search]');
      if (!button) return;
      input.value = button.dataset.search;
      render(input.value);
    });
    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('input', () => render(input.value));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const first = results.querySelector('a');
      if (first) location.href = first.href;
    });
    document.addEventListener('click', event => {
      if (!form.contains(event.target)) {
        popover.hidden = true;
        input.setAttribute('aria-expanded','false');
      }
    });
    if (rotating) {
      let promptIndex = 0;
      const rotate = () => {
        if (document.activeElement !== input && !input.value) {
          input.placeholder = prompts[promptIndex % prompts.length];
          promptIndex += 1;
        }
      };
      rotate();
      setInterval(rotate, 2600);
    }
    if (new URLSearchParams(location.search).get('search') === '1') {
      requestAnimationFrame(() => { input.focus(); render(''); history.replaceState(null,'',location.pathname); });
    }
  }

  window.BurlingtonSearch = { install, ranked, index };
})();
