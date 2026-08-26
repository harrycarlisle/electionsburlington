(() => {
  const root = document.documentElement;
  const storageKey = 'burlington-news-theme';
  const path = location.pathname;
  const isHome = () => {
    const clean = path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
    return clean === '/';
  };
  const isArticle = () => /\/(articles|stories)\//.test(path);
  const isElectionGuide = () => /elections/.test(path) || /election-guide\.html$/.test(path);
  const isElectionPage = () => isElectionGuide() || /(head-to-head|ballot|ward|promises|elections-for-beginners)\.html$/.test(path);

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem('burlington-election-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return matchMedia('(max-width: 720px)').matches && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function themeIcon(theme) {
    return theme === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.7 8.7 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function setTheme(theme, persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const target = next === 'dark' ? 'light' : 'dark';
      button.innerHTML = themeIcon(next);
      button.setAttribute('aria-label', `Switch to ${target} mode`);
    });
    if (persist) try { localStorage.setItem(storageKey, next); } catch (_) {}
  }

  function ensureStyle(href, key) {
    const existing = document.querySelector(`link[data-style="${key}"]`);
    if (existing) {
      existing.href = href;
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.style = key;
    document.head.appendChild(link);
  }

  function ensureScript(src, key) {
    const base = src.split('?')[0];
    if (document.querySelector(`script[data-feature="${key}"], script[src*="${base}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.feature = key;
    document.head.appendChild(script);
  }

  function ensureStyles() {
    ensureStyle('/site-bundle.css?v=20260824z4', 'site-bundle');
    ensureStyle('/site-shell.css?v=20260824z4', 'site-shell');
    ensureStyle('/publication-polish.css?v=20260825t', 'publication-polish');
    ensureStyle('/product-pass.css?v=20260826f', 'product-pass');
    ensureStyle('/site-header.css?v=20260826f', 'site-header');
    if (isArticle()) ensureStyle('/article-modern.css?v=20260825r', 'article-modern');
    if (isElectionGuide()) ensureStyle('/elections-guide.css?v=20260826f', 'elections-guide');
  }

  function ensureUtilityBar() {
    document.querySelector('.publication-utility')?.remove();
  }

  function ensureBanner() {
    let banner = document.querySelector('.banner');
    const header = document.querySelector('.header, .site-header');
    if (!isElectionPage()) {
      banner?.remove();
      return;
    }
    if (!banner && header) {
      banner = document.createElement('div');
      banner.className = 'banner';
      header.before(banner);
    }
    if (banner) banner.innerHTML = '<div class="wrap"><strong>2026 election</strong><span class="banner-sep" aria-hidden="true"> · </span><span>Voting starts Oct. 14</span><span class="banner-sep" aria-hidden="true"> · </span><span>Election Day Oct. 26</span></div>';
  }

  function brandMarkup() {
    return '<img class="news-brand-logo" src="/logo-mark.png?v=20260825a" alt="">';
  }

  function applyBrand() {
    document.querySelectorAll('.header .brand, .site-header .brand').forEach(brand => {
      brand.className = 'brand news-brand brand-mark-only';
      brand.href = '/';
      brand.innerHTML = brandMarkup();
      brand.setAttribute('aria-label', 'Burlington News home');
    });
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = '/logo-mark.png?v=20260825a';
    let touch = document.querySelector('link[rel="apple-touch-icon"]');
    if (!touch) {
      touch = document.createElement('link');
      touch.rel = 'apple-touch-icon';
      document.head.appendChild(touch);
    }
    touch.href = '/logo-mark.png?v=20260825a';
  }

  function addSeo() {
    if (isHome()) document.title = 'Burlington News | Local news, events and election coverage';
    const description = document.querySelector('meta[name="description"]');
    if (isHome() && description) description.content = 'Independent Burlington, Ontario news, things to do, food, sports, local discoveries and clear municipal election coverage.';
    if (!document.querySelector('link[rel="canonical"]')) {
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = `https://burlingtonnews.ca${location.pathname === '/' ? '/' : location.pathname}`;
      document.head.appendChild(canonical);
    }
    const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const metas = [
      ['og:type', isArticle() ? 'article' : 'website'],
      ['og:site_name', 'Burlington News'],
      ['og:locale', 'en_CA'],
      ['og:title', document.title || 'Burlington News'],
      ['og:description', description?.content || 'Independent Burlington, Ontario civic news and election explainers.'],
      ['og:url', canonical],
      ['twitter:card', 'summary_large_image']
    ];
    metas.forEach(([key, value]) => {
      let meta = document.querySelector(`meta[property="${key}"],meta[name="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        if (key.startsWith('twitter:')) meta.name = key;
        else meta.setAttribute('property', key);
        document.head.appendChild(meta);
      }
      meta.content = value;
    });
    if (!document.querySelector('meta[property="og:image"]')) {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:image');
      meta.content = 'https://burlingtonnews.ca/assets/editorial/home-share.webp';
      document.head.appendChild(meta);
    }
    if (!isArticle()) {
      document.getElementById('siteStructuredData')?.remove();
      const ld = document.createElement('script');
      ld.id = 'siteStructuredData';
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsMediaOrganization',
        name: 'Burlington News',
        url: 'https://burlingtonnews.ca/',
        description: 'Independent Burlington, Ontario news, local discoveries and municipal election coverage.',
        inLanguage: 'en-CA',
        areaServed: { '@type': 'City', name: 'Burlington, Ontario, Canada' }
      });
      document.head.appendChild(ld);
    }
  }

  function torontoToday() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  function electionInPrimaryNav() {
    const until = window.BN_ELECTION_PRIMARY_UNTIL || '2026-11-09';
    return torontoToday() <= until;
  }

  function currentSection() {
    if (isHome()) return 'home';
    if (isElectionPage()) return 'elections';
    if (path.includes('explore')) return 'explore';
    if (path.includes('sports')) return 'sports';
    if (path.includes('puzzles') || path.includes('/games')) return 'games';
    if (path.includes('work-with-us')) return 'work';
    if (path.includes('feedback')) return 'feedback';
    if (path.includes('about')) return 'about';
    if (path.includes('methodology')) return 'sources';
    if (path.includes('help')) return 'help';
    if (path.includes('updates') || path.includes('/news') || path.includes('/articles/') || path.includes('/stories/') || path.includes('/guides/')) return 'news';
    return '';
  }

  function navLink(href, key, label, kind) {
    const section = currentSection();
    const active = section === key;
    const extra = kind === 'secondary' ? ' menu-secondary-link' : '';
    return `<a class="menu-link${extra}${active ? ' is-active' : ''}" role="listitem" href="${href}"${active ? ' aria-current="page"' : ''}><span>${label}</span></a>`;
  }

  function buildDrawer(nav) {
    const electionPrimary = electionInPrimaryNav();
    nav.className = 'nav menu-panel';
    nav.innerHTML = `
      <button class="menu-theme-toggle" type="button" data-theme-toggle aria-label="Switch theme"></button>
      <p class="menu-heading">Main</p>
      <div class="menu-primary" role="list">
        ${navLink('/', 'home', 'Home')}
        ${navLink('/news/', 'news', 'News')}
        ${electionPrimary ? navLink('/elections/', 'elections', 'Elections') : ''}
        ${navLink('/explore/', 'explore', 'Explore')}
        ${navLink('/sports/', 'sports', 'Sports')}
        ${navLink('/games/', 'games', 'Puzzles')}
      </div>
      <div class="menu-separator" aria-hidden="true"></div>
      <p class="menu-heading">Secondary</p>
      <div class="menu-primary menu-secondary" role="list">
        ${electionPrimary ? '' : navLink('/elections/', 'elections', 'Elections', 'secondary')}
        ${navLink('/about.html', 'about', 'About', 'secondary')}
        ${navLink('/methodology.html', 'sources', 'Sources', 'secondary')}
        ${navLink('/help.html', 'help', 'Help & accessibility', 'secondary')}
        ${navLink('/feedback/', 'feedback', 'Feedback', 'secondary')}
        ${navLink('/work-with-us/', 'work', 'Work with us', 'secondary')}
      </div>`;
  }

  function weatherChipMarkup() {
    return '<span class="header-weather" data-weather-chip data-weather-alert-host><span class="weather-chip-summary" data-weather-temperature aria-label="Burlington weather"><span class="weather-chip-icon weather-chip-clear" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg></span><strong class="weather-chip-temp">--</strong></span></span>';
  }

  function searchMarkup() {
    return '<form class="header-search" role="search" autocomplete="off"><label class="sr-only" for="siteSearch">Search Burlington</label><input id="siteSearch" type="search" spellcheck="false" aria-autocomplete="list" aria-controls="searchResults" aria-expanded="false" placeholder="Search Burlington"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.8"></circle><path d="m15 15 4.2 4.2"></path></svg><div class="search-popover" hidden><div class="search-suggestions"></div><div class="search-results" role="listbox" aria-live="polite"></div></div></form>';
  }

  function ensureBackdrop() {
    let backdrop = document.querySelector('.menu-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'menu-backdrop';
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  function prepareHeader() {
    const header = document.querySelector('.header, .site-header');
    let inner = document.querySelector('.header-inner');
    if (!inner) {
      const masthead = document.querySelector('.masthead');
      if (masthead) {
        masthead.classList.add('header-inner');
        inner = masthead;
      }
    }
    if (!inner) return;

    inner.querySelector('.back')?.remove();
    let brand = inner.querySelector('.brand');
    if (!brand) {
      brand = document.createElement('a');
      inner.prepend(brand);
    }
    brand.className = 'brand news-brand brand-mark-only';
    brand.href = '/';
    brand.innerHTML = brandMarkup();
    brand.setAttribute('aria-label', 'Burlington News home');

    let nav = document.getElementById('mainNav') || document.getElementById('primaryNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'mainNav';
      nav.setAttribute('aria-label', 'Primary');
      inner.appendChild(nav);
    }
    nav.id = 'mainNav';

    let old = document.getElementById('menuBtn') || document.getElementById('menuButton');
    if (!old) {
      old = document.createElement('button');
      old.id = 'menuBtn';
      old.type = 'button';
      old.className = 'menu';
      old.setAttribute('aria-controls', 'mainNav');
      inner.appendChild(old);
    }

    const menu = old.cloneNode(false);
    menu.id = 'menuBtn';
    menu.className = 'menu menu-icon-button';
    menu.setAttribute('aria-label', 'Open site menu');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-controls', 'mainNav');
    menu.innerHTML = '<span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
    old.replaceWith(menu);

    let controls = inner.querySelector('.header-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'header-controls';
      inner.insertBefore(controls, menu);
    }

    let search = controls.querySelector('.header-search') || inner.querySelector('.header-search');
    if (!search) {
      controls.insertAdjacentHTML('beforeend', searchMarkup());
      search = controls.querySelector('.header-search');
    } else {
      const input = search.querySelector('input');
      const label = search.querySelector('label');
      if (input && !isHome()) {
        input.placeholder = 'Search Burlington';
        input.removeAttribute('id');
        input.id = 'siteSearch';
      }
      if (label) {
        label.textContent = 'Search Burlington';
        label.setAttribute('for', 'siteSearch');
      }
      if (!controls.contains(search)) controls.appendChild(search);
    }

    let weather = controls.querySelector('[data-weather-chip]') || inner.querySelector('[data-weather-chip]');
    if (!weather) {
      controls.insertAdjacentHTML('afterbegin', weatherChipMarkup());
      weather = controls.querySelector('[data-weather-chip]');
    } else if (!controls.contains(weather)) {
      controls.insertBefore(weather, search);
    }

    controls.querySelector('.site-search-link')?.remove();
    controls.appendChild(menu);
    inner.querySelector('#primaryNav')?.remove();

    buildDrawer(nav);
    const backdrop = ensureBackdrop();

    const close = (focus = false) => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-is-open');
      backdrop.hidden = true;
      if (focus) menu.focus();
    };

    const openMenu = () => {
      const headerEl = document.querySelector('.header, .site-header');
      const bottom = Math.ceil((headerEl?.getBoundingClientRect().bottom || 0));
      root.style.setProperty('--mobile-menu-top', `${bottom + 8}px`);
      nav.classList.add('open');
      menu.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-is-open');
      backdrop.hidden = false;
      requestAnimationFrame(() => nav.querySelector('a,button')?.focus());
    };

    menu.addEventListener('click', event => {
      event.stopPropagation();
      if (nav.classList.contains('open')) close();
      else openMenu();
    });
    nav.addEventListener('click', event => event.stopPropagation());
    nav.querySelector('[data-theme-toggle]')?.addEventListener('click', event => {
      event.stopPropagation();
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close()));
    backdrop.addEventListener('click', () => close());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) close(true);
    });
    setTheme(root.dataset.theme || preferredTheme(), false);
  }

  function installDesktopNav() {
    const inner = document.querySelector('.header-inner');
    const controls = document.querySelector('.header-controls');
    if (!inner || !controls) return;
    inner.querySelector('.desktop-primary-nav')?.remove();
    inner.querySelector('.home-desktop-nav')?.remove();
    const nav = document.createElement('nav');
    nav.className = 'desktop-primary-nav publication-nav';
    nav.setAttribute('aria-label', 'Sections');
    nav.innerHTML = electionInPrimaryNav()
      ? '<a href="/" data-section="home">Home</a><a href="/news/" data-section="news">News</a><a href="/elections/" data-section="elections">Elections</a><a href="/explore/" data-section="explore">Explore</a><a href="/sports/" data-section="sports">Sports</a><a href="/games/" data-section="games">Puzzles</a>'
      : '<a href="/" data-section="home">Home</a><a href="/news/" data-section="news">News</a><a href="/explore/" data-section="explore">Explore</a><a href="/sports/" data-section="sports">Sports</a><a href="/games/" data-section="games">Puzzles</a>';
    const active = currentSection();
    if (active) {
      const link = nav.querySelector(`[data-section="${active}"]`);
      link?.classList.add('active');
      link?.setAttribute('aria-current', 'page');
    }
    inner.insertBefore(nav, controls);
  }

  function rotateSearchPrompt() {}

  function candidateData() {
    return [...document.querySelectorAll('#candidateStrip .candidate-card')].map((card, index) => ({
      card,
      index,
      name: card.querySelector('h3')?.textContent.trim() || `Candidate ${index + 1}`,
      img: card.querySelector('img')?.src || '',
      initials: (card.querySelector('h3')?.textContent || '').split(/\s+/).map(part => part[0]).join('').slice(0, 2)
    }));
  }

  function buildHero() {
    const candidates = document.getElementById('candidates');
    const main = document.getElementById('main');
    if (!candidates || !main || document.querySelector('.election-hero')) return;
    document.body.classList.add('landing-home');
    candidates.querySelector(':scope > .eyebrow')?.remove();
    candidates.querySelector(':scope > .section-intro')?.remove();
    candidates.querySelector(':scope > .section-deck')?.remove();
    const old = candidates.querySelector(':scope > h1');
    if (old) {
      const heading = document.createElement('h2');
      heading.textContent = 'Meet the mayoral candidates';
      old.replaceWith(heading);
    }
    const people = candidateData();
    const hero = document.createElement('section');
    hero.className = 'election-hero';
    hero.setAttribute('aria-labelledby', 'heroTitle');
    hero.innerHTML = `<div class="hero-copy"><h1 id="heroTitle">Burlington's municipal election, explained.</h1><div class="hero-actions"><a class="hero-button hero-button-primary" href="head-to-head.html">Compare mayoral candidates <span aria-hidden="true">→</span></a><a class="hero-button hero-button-secondary" href="ballot.html">See your ballot</a></div><div class="hero-trust"><span>No endorsements</span><span>Independent</span></div></div><div class="hero-visual" aria-hidden="true"><div class="hero-map-card"><div class="hero-place-dot"></div><div class="hero-candidate-slide" id="heroCandidateSlide"></div><div class="hero-date-card"><span>Election day</span><strong>OCT 26</strong><small>2026</small></div><div class="hero-voting-note"><span>Voting starts</span><strong>Oct. 14</strong></div></div></div>`;
    main.insertBefore(hero, candidates);
    const slide = hero.querySelector('#heroCandidateSlide');
    let i = 0;
    const paint = () => {
      if (!people.length) return;
      const person = people[i % people.length];
      slide.classList.add('is-changing');
      setTimeout(() => {
        slide.innerHTML = person.img
          ? `<img src="${person.img}" alt=""><span>${person.name}</span>`
          : `<span class="hero-candidate-initials">${person.initials}</span><span>${person.name}</span>`;
        slide.classList.remove('is-changing');
      }, 120);
    };
    paint();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && people.length > 1) {
      setInterval(() => {
        i = (i + 1) % people.length;
        paint();
      }, 3200);
    }
  }

  function setupCandidateScroll() {}

  function ensureFooter() {
    document.querySelectorAll('a[href="/feedback/?type=partner"], a[href="feedback/?type=partner"]').forEach(link => {
      link.href = '/work-with-us/';
    });
    if (isHome()) return;
    let footer = document.querySelector('.site-legal-footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'site-legal-footer';
      document.body.appendChild(footer);
    }
    footer.innerHTML = '<div class="site-legal-footer-inner"><div class="footer-news-brand"><span class="news-brand-mark" aria-hidden="true"></span><div><strong>Burlington News</strong><p>Independent news for Burlington, Ontario.</p></div></div><div class="site-footer-columns"><nav aria-label="Explore"><strong>Explore</strong><a href="/news/">News</a><a href="/elections/">Elections</a><a href="/explore/">Explore</a><a href="/sports/">Sports</a><a href="/games/">Puzzles</a></nav><nav aria-label="About"><strong>About</strong><a href="/about.html">About</a><a href="/methodology.html">Sources</a><a href="/help.html#accessibility">Accessibility</a><a href="/feedback/">Feedback</a><a href="/work-with-us/">Work with us</a></nav></div></div>';
  }

  function applyTiming(data) {
    if (data?.election?.primaryNavUntil) window.BN_ELECTION_PRIMARY_UNTIL = data.election.primaryNavUntil;
  }

  setTheme(preferredTheme(), false);
  fetch('/data/site-timing.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(applyTiming)
    .catch(() => {});

  document.addEventListener('DOMContentLoaded', () => {
    if (isHome()) document.body.classList.add('home-shell');
    else document.body.classList.add('publication-shell');
    if (!isHome()) ensureStyles();
    else ensureStyle('/site-header.css?v=20260826f', 'site-header');
    ensureUtilityBar();
    ensureBanner();
    addSeo();
    prepareHeader();
    installDesktopNav();
    rotateSearchPrompt();
    if (!isElectionGuide()) {
      buildHero();
      setupCandidateScroll();
    }
    const electionHeading = document.querySelector('#candidates>h2, #candidates>h1');
    if (electionHeading) electionHeading.textContent = 'Meet the mayoral candidates';
    ensureFooter();
    applyBrand();
    ensureScript('/site-search.js?v=20260826e', 'site-search');
    if (!isHome() && !isElectionPage() && !isArticle()) ensureScript('/site-bundle.js?v=20260825p', 'site-bundle');
    ensureScript('/weather-alert.js?v=20260826e', 'weather-alert');
    if (isArticle()) ensureScript('/article-modern.js?v=20260826c', 'article-modern');
    setTheme(root.dataset.theme || preferredTheme(), false);
    const search = document.querySelector('.header-search');
    const ready = () => {
      if (search && window.BurlingtonSearch) {
        window.BurlingtonSearch.install(search, { homepage: isHome(), rotate: isHome() });
      }
    };
    if (window.BurlingtonSearch) ready();
    else {
      const wait = setInterval(() => {
        if (window.BurlingtonSearch) {
          clearInterval(wait);
          ready();
        }
      }, 30);
      setTimeout(() => clearInterval(wait), 2500);
    }
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    let saved = '';
    try { saved = localStorage.getItem(storageKey) || localStorage.getItem('burlington-election-theme') || ''; } catch (_) {}
    if (!saved && matchMedia('(max-width: 720px)').matches) setTheme(preferredTheme(), false);
  });
})();
