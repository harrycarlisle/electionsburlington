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
    if (window.BurlingtonTheme) {
      return window.BurlingtonTheme.apply(window.BurlingtonTheme.savedMode(), false);
    }
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
    if (window.BurlingtonTheme) {
      const mode = theme === 'auto' ? 'auto' : (theme === 'dark' ? 'dark' : 'light');
      const appearance = window.BurlingtonTheme.apply(mode, persist);
      document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        const target = appearance === 'dark' ? 'light' : 'dark';
        const label = `Switch to ${target} mode`;
        button.innerHTML = themeIcon(appearance);
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
      });
      return appearance;
    }
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const target = next === 'dark' ? 'light' : 'dark';
      const label = `Switch to ${target} mode`;
      button.innerHTML = themeIcon(next);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
    if (persist) try { localStorage.setItem(storageKey, next); } catch (_) {}
    return next;
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
    ensureStyle('/product-pass.css?v=20260826u', 'product-pass');
    if (isArticle()) ensureStyle('/article-modern.css?v=20260826tb', 'article-modern');
    if (isElectionGuide()) ensureStyle('/elections-guide.css?v=20260826f', 'elections-guide');
    ensureStyle('/type-system.css?v=20260826a', 'type-system');
    ensureStyle('/site-header.css?v=20260826ta', 'site-header');
    ensureStyle('/desktop-system.css?v=20260826ta', 'desktop-system');
  }

  function ensureUtilityBar() {
    document.querySelector('.publication-utility')?.remove();
  }

  function ensureBanner() {
    let banner = document.querySelector('.banner');
    const header = document.querySelector('.header, .site-header');
    if (!isElectionPage()) {
      banner?.remove();
      root.style.setProperty('--news-banner-h', '0px');
      return;
    }
    root.style.setProperty('--news-banner-h', matchMedia('(max-width:720px)').matches ? '32px' : '34px');
    if (!banner && header) {
      banner = document.createElement('div');
      banner.className = 'banner';
      header.before(banner);
    }
    if (banner) banner.innerHTML = '<div class="wrap"><strong>2026 election</strong><span class="banner-sep" aria-hidden="true"> · </span><span>Voting starts Oct. 14</span><span class="banner-sep" aria-hidden="true"> · </span><span>Election Day Oct. 26</span></div>';
  }

  const BRAND_ICON = '/assets/brand/favicon-32x32.png';
  const BRAND_TOUCH = '/assets/brand/apple-touch-icon.png';
  const BRAND_MARK = '/logo-mark.png?v=20260826ta';

  function brandMarkup() {
    return `<img class="news-brand-logo" src="${BRAND_MARK}" alt="">`;
  }

  function ensureHeadLink(rel, href, attrs) {
    let node = document.querySelector(`link[rel="${rel}"]${attrs?.sizes ? `[sizes="${attrs.sizes}"]` : ''}`);
    if (!node) {
      node = document.createElement('link');
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href;
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function applyBrand() {
    document.querySelectorAll('.header .brand, .site-header .brand').forEach(brand => {
      brand.className = 'brand news-brand brand-mark-only';
      brand.href = '/';
      brand.innerHTML = brandMarkup();
      brand.setAttribute('aria-label', 'Burlington News home');
    });
    ensureHeadLink('icon', BRAND_ICON, { type: 'image/png', sizes: '32x32' });
    ensureHeadLink('icon', '/assets/brand/favicon-16x16.png', { type: 'image/png', sizes: '16x16' });
    ensureHeadLink('shortcut icon', BRAND_ICON);
    ensureHeadLink('apple-touch-icon', BRAND_TOUCH);
    ensureHeadLink('manifest', '/site.webmanifest');
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = '#071b35';
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
        logo: { '@type': 'ImageObject', url: 'https://burlingtonnews.ca/assets/brand/android-chrome-512x512.png' },
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
    if (path.includes('about') || path.includes('editorial-standards') || path.includes('ai-policy') || path.includes('corrections')) return 'about';
    if (path.includes('methodology') || path.includes('/sources')) return 'sources';
    if (path.includes('/go')) return 'go';
    if (path.includes('/traffic') || path.includes('skyway')) return 'traffic';
    if (path.includes('/development')) return 'development';
    if (path.includes('/parking') || path.includes('/beach') || path.includes('/taxes')) return 'utility';
    if (path.includes('/safety') || path.includes('crime')) return 'safety';
    if (path.includes('/food') || path.includes('food-spots')) return 'food';
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

  function drawerSearchMarkup() {
    return `<form class="drawer-search header-search" data-drawer-search role="search" autocomplete="off"><label class="sr-only" for="drawerSearchInput">Search Burlington News</label><input id="drawerSearchInput" type="search" spellcheck="false" aria-autocomplete="list" aria-controls="drawerSearchResults" aria-expanded="false" placeholder="Search anything..."><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.8"></circle><path d="m15 15 4.2 4.2"></path></svg><div class="search-popover" hidden><div class="search-suggestions" hidden></div><div class="search-results" id="drawerSearchResults" role="listbox" aria-live="polite"></div></div></form>`;
  }

  function buildDrawer(nav) {
    const electionPrimary = electionInPrimaryNav();
    nav.className = 'nav menu-panel';
    nav.innerHTML = `
      <div class="menu-drawer-top">
        <button class="menu-theme-toggle" type="button" data-theme-toggle aria-label="Switch theme"></button>
        ${drawerSearchMarkup()}
      </div>
      <button class="menu-theme-auto" type="button" data-theme-auto>Use automatic theme</button>
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
        ${navLink('/traffic/', 'traffic', 'Traffic', 'secondary')}
        ${navLink('/go/', 'go', 'GO', 'secondary')}
        ${navLink('/development/', 'development', 'Development', 'secondary')}
        ${navLink('/about/', 'about', 'About', 'secondary')}
        ${navLink('/methodology.html', 'sources', 'Sources', 'secondary')}
        ${navLink('/help.html', 'help', 'Help & accessibility', 'secondary')}
        ${navLink('/feedback/', 'feedback', 'Feedback', 'secondary')}
        ${navLink('/work-with-us/', 'work', 'Work with us', 'secondary')}
      </div>
      <div class="menu-drawer-util">
        <a class="drawer-weather-line" href="https://weather.gc.ca/city/pages/on-15_metric_e.html" rel="noopener" data-weather-temperature data-weather-drawer>Burlington weather</a>
      </div>`;
    installDrawerSearch(nav);
    try { window.BurlingtonWeather?.load(); } catch (_) {}
  }

  function installDrawerSearch(nav) {
    const form = (nav || document).querySelector('[data-drawer-search]');
    if (form && window.BurlingtonSearch) {
      window.BurlingtonSearch.install(form, {homepage:false, drawer:true, rotate:true, prompts:window.BurlingtonSearch.DRAWER_PROMPTS, placeholder:'Search “Best food”'});
    }
  }

  function weatherChipMarkup() {
    return '<span class="header-weather" hidden data-weather-chip data-weather-alert-host><span class="weather-chip-summary" data-weather-temperature aria-label="Burlington weather"></span></span>';
  }

  function themeToggleMarkup() {
    return '<button class="header-theme-toggle" type="button" data-theme-toggle title="Switch to dark mode" aria-label="Switch to dark mode"></button>';
  }

  function searchMarkup() {
    return '<form class="header-search" role="search" autocomplete="off"><label class="sr-only" for="siteSearch">Search Burlington News</label><input id="siteSearch" type="search" spellcheck="false" aria-autocomplete="list" aria-controls="searchResults" aria-expanded="false" placeholder="Search Burlington News"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.8"></circle><path d="m15 15 4.2 4.2"></path></svg><div class="search-popover" hidden><div class="search-suggestions"></div><div class="search-results" role="listbox" aria-live="polite"></div></div></form>';
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
    if (header?.dataset.bnShell === 'ready') return;
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
        input.placeholder = 'Search anything...';
        input.removeAttribute('id');
        input.id = 'siteSearch';
      }
      if (label) {
        label.textContent = 'Search Burlington News';
        label.setAttribute('for', 'siteSearch');
      }
      if (!controls.contains(search)) controls.appendChild(search);
    }

    syncHeaderWeather(controls, search);

    controls.querySelector('.site-search-link')?.remove();
    controls.appendChild(menu);
    const live = inner.querySelector('#headerLive');
    if (live) {
      const brand = inner.querySelector('.brand');
      if (brand) brand.after(live);
    }
    inner.querySelector('#primaryNav')?.remove();

    buildDrawer(nav);
    const backdrop = ensureBackdrop();
    let lockY = 0;

    const unlockScroll = () => {
      document.documentElement.classList.remove('menu-is-open');
      document.body.classList.remove('menu-is-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, lockY);
    };

    const lockScroll = () => {
      lockY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add('menu-is-open');
      document.body.classList.add('menu-is-open');
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    };

    const close = (focus = false) => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open site menu');
      backdrop.hidden = true;
      unlockScroll();
      if (focus) menu.focus();
    };

    const openMenu = () => {
      const headerEl = document.querySelector('.header, .site-header');
      const bottom = Math.ceil((headerEl?.getBoundingClientRect().bottom || 0));
      root.style.setProperty('--mobile-menu-top', `${bottom + 8}px`);
      nav.classList.add('open');
      menu.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-label', 'Close site menu');
      backdrop.hidden = false;
      lockScroll();
      requestAnimationFrame(() => nav.querySelector('.menu-primary a, a.menu-link')?.focus());
    };

    if (header) header.dataset.bnShell = 'ready';

    menu.addEventListener('click', event => {
      event.stopPropagation();
      if (nav.classList.contains('open')) close();
      else openMenu();
    });
    nav.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-theme-auto]')) {
        setTheme('auto');
        return;
      }
      if (event.target.closest('[data-theme-toggle]')) {
        if (window.BurlingtonTheme) window.BurlingtonTheme.toggleManual();
        else setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        setTheme(root.dataset.theme, false);
        return;
      }
      const link = event.target.closest('a');
      if (link && !link.closest('[data-drawer-search]')) close();
    });
    backdrop.addEventListener('click', () => close());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) close(true);
    });
    matchMedia('(min-width:721px)').addEventListener?.('change', event => {
      if (event.matches) close();
      syncHeaderWeather(controls, search);
    });
    window.addEventListener('resize', () => {
      if (!nav.classList.contains('open')) return;
      const headerEl = document.querySelector('.header, .site-header');
      root.style.setProperty('--mobile-menu-top', `${Math.ceil((headerEl?.getBoundingClientRect().bottom || 0) + 8)}px`);
    });
    setTheme(root.dataset.theme || preferredTheme(), false);
  }

  function syncHeaderWeather(controls, search) {
    if (!controls) return;
    const desktop = matchMedia('(min-width:721px)').matches;
    let weather = controls.querySelector('[data-weather-chip]') || document.querySelector('.header [data-weather-chip], .site-header [data-weather-chip]');
    let theme = controls.querySelector('.header-theme-toggle');
    if (!desktop) {
      weather?.remove();
      theme?.remove();
      return;
    }
    if (!weather) {
      controls.insertAdjacentHTML('afterbegin', weatherChipMarkup());
      weather = controls.querySelector('[data-weather-chip]');
      try { window.BurlingtonWeather?.load(); } catch (_) {}
    } else if (!controls.contains(weather)) {
      controls.insertBefore(weather, search || controls.firstChild);
    }
    if (theme && search) search.after(theme);
    if (!theme) {
      if (search) search.insertAdjacentHTML('afterend', themeToggleMarkup());
      else controls.insertAdjacentHTML('beforeend', themeToggleMarkup());
      theme = controls.querySelector('.header-theme-toggle');
      theme?.addEventListener('click', event => {
        event.preventDefault();
        if (window.BurlingtonTheme) window.BurlingtonTheme.toggleManual();
        else setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        setTheme(root.dataset.theme, false);
      });
    }
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
    footer.innerHTML = '<div class="site-legal-footer-inner"><div class="footer-news-brand"><span class="news-brand-mark" aria-hidden="true"></span><div><strong>Burlington News</strong><p>Independent news for Burlington, Ontario.</p></div></div><div class="site-footer-columns"><nav aria-label="Explore"><strong>Explore</strong><a href="/news/">News</a><a href="/elections/">Elections</a><a href="/explore/">Explore</a><a href="/traffic/">Traffic</a><a href="/go/">GO</a><a href="/development/">Development</a><a href="/sports/">Sports</a></nav><nav aria-label="About"><strong>About</strong><a href="/about/">About</a><a href="/editorial-standards/">Editorial standards</a><a href="/corrections/">Corrections</a><a href="/methodology.html">Sources</a><a href="/feedback/">Feedback</a><a href="/work-with-us/">Work with us</a></nav></div><p class="preferred-source"><a href="https://www.google.com/preferences/source?q=burlingtonnews.ca">Add Burlington News as a preferred source on Google</a></p></div>';
  }

  function applyTiming(data) {
    if (data?.election?.primaryNavUntil) window.BN_ELECTION_PRIMARY_UNTIL = data.election.primaryNavUntil;
  }

  setTheme(preferredTheme(), false);
  fetch('/data/site-timing.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      applyTiming(data);
      const nav = document.getElementById('mainNav');
      if (nav?.classList.contains('menu-panel')) {
        buildDrawer(nav);
        installDesktopNav();
        setTheme(root.dataset.theme || preferredTheme(), false);
      }
    })
    .catch(() => {});

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('publication-shell');
    if (isHome()) document.body.classList.add('home-shell');
    if (!isHome()) ensureStyles();
    else {
      ensureStyle('/type-system.css?v=20260826a', 'type-system');
      ensureStyle('/site-header.css?v=20260826ta', 'site-header');
      ensureStyle('/desktop-system.css?v=20260826hf', 'desktop-system');
    }
    ensureScript('/theme-boot.js?v=20260826ds', 'theme-boot');
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
    ensureScript('/site-search.js?v=20260826gt', 'site-search');
    if (!isHome() && !isElectionPage() && !isArticle() && !document.body.classList.contains('authority-page') && !document.body.classList.contains('food-passport-page')) {
      ensureScript('/site-bundle.js?v=20260826w', 'site-bundle');
    }
    ensureScript('/weather-alert.js?v=20260826f', 'weather-alert');
    if (isArticle()) ensureScript('/article-modern.js?v=20260826tb', 'article-modern');
    setTheme(root.dataset.theme || preferredTheme(), false);
    const search = document.querySelector('.header-controls .header-search');
    const ready = () => {
      if (search && window.BurlingtonSearch) {
        window.BurlingtonSearch.install(search, { homepage: isHome(), rotate: isHome() });
      }
      installDrawerSearch(document.getElementById('mainNav'));
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
