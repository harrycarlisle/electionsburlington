(() => {
  const root = document.documentElement;
  const storageKey = 'burlington-election-theme';

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme, persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = next === 'dark' ? 'Use light mode' : 'Use dark mode';
      button.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
    if (persist) {
      try { localStorage.setItem(storageKey, next); } catch (_) {}
    }
  }

  function translateUrl(language) {
    const target = encodeURIComponent(window.location.href);
    return `https://translate.google.com/translate?sl=en&tl=${encodeURIComponent(language)}&u=${target}`;
  }

  function isHomePage() {
    const path = window.location.pathname;
    return path === '/' || path.endsWith('/index.html') || path.endsWith('electionsburlington.ca');
  }

  function homeLink(hash) {
    return isHomePage() ? hash : `index.html${hash}`;
  }

  function ensureExtraStyles() {
    if (!document.querySelector('link[data-election-dates]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'dates-extra.css?v=20260823b';
      link.dataset.electionDates = '';
      document.head.appendChild(link);
    }
  }

  function buildDrawer(nav) {
    if (!nav) return;
    nav.classList.add('menu-panel');
    nav.innerHTML = `
      <div class="menu-panel-head"><span>Explore the guide</span></div>
      <div class="menu-primary" role="list">
        <a class="menu-link" role="listitem" href="${homeLink('#candidates')}"><span>Candidates</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#matters')}"><span>Issues</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="head-to-head.html"><span>Head-to-head</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#dates')}"><span>Important dates</span><span aria-hidden="true">›</span></a>
        <a class="menu-link" role="listitem" href="${homeLink('#method')}"><span>Sources & methodology</span><span aria-hidden="true">›</span></a>
      </div>
      <div class="menu-separator" aria-hidden="true"></div>
      <div class="menu-support" role="list">
        <a class="menu-support-link" role="listitem" href="help.html">Help</a>
        <a class="menu-support-link" role="listitem" href="https://github.com/harrycarlisle/electionsburlington/issues/new" target="_blank" rel="noopener">Give feedback <span class="sr-only">(opens in a new tab)</span></a>
      </div>
      <div class="menu-separator" aria-hidden="true"></div>
      <div class="menu-preferences">
        <div class="menu-pref-row">
          <label for="siteLanguage">Translate</label>
          <select id="siteLanguage" class="language-select" aria-label="Translate this page">
            <option value="">English</option><option value="fr">Français</option><option value="zh-CN">中文</option><option value="pa">ਪੰਜਾਬੀ</option><option value="es">Español</option><option value="ar">العربية</option><option value="hi">हिन्दी</option>
          </select>
        </div>
        <div class="menu-pref-row"><span>Appearance</span><button type="button" class="nav-action" data-theme-toggle>Dark mode</button></div>
      </div>`;

    const language = nav.querySelector('#siteLanguage');
    language?.addEventListener('change', () => {
      if (!language.value) return;
      window.location.assign(translateUrl(language.value));
    });
    nav.querySelector('[data-theme-toggle]')?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  }

  function enhanceMenu() {
    const oldMenu = document.getElementById('menuBtn');
    const nav = document.getElementById('mainNav');
    if (!oldMenu || !nav) return;
    const menu = oldMenu.cloneNode(false);
    menu.className = 'menu menu-icon-button';
    menu.setAttribute('aria-label', 'Open site menu');
    menu.setAttribute('aria-expanded', 'false');
    menu.innerHTML = '<span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">Menu</span>';
    oldMenu.replaceWith(menu);
    buildDrawer(nav);

    const closeMenu = (returnFocus = false) => {
      nav.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Open site menu');
      document.body.classList.remove('menu-is-open');
      if (returnFocus) menu.focus();
    };
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !nav.classList.contains('open');
      if (open) {
        nav.classList.add('open');
        menu.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-label', 'Close site menu');
        document.body.classList.add('menu-is-open');
      } else closeMenu();
    });
    nav.addEventListener('click', (event) => event.stopPropagation());
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()));
    document.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) closeMenu(true);
    });
  }

  function buildHero() {
    const candidates = document.getElementById('candidates');
    const main = document.getElementById('main');
    if (!candidates || !main || document.querySelector('.election-hero')) return;
    document.body.classList.add('landing-home');
    candidates.querySelector(':scope > .eyebrow')?.remove();
    candidates.querySelector(':scope > .section-intro')?.remove();
    const originalHeading = candidates.querySelector(':scope > h1');
    if (originalHeading) {
      const h2 = document.createElement('h2');
      h2.textContent = 'Meet the candidates';
      originalHeading.replaceWith(h2);
    }
    if (!candidates.querySelector(':scope > .section-deck')) {
      const deck = document.createElement('p');
      deck.className = 'section-deck';
      deck.textContent = 'Choose a candidate to see their priorities, experience, questions worth asking, local discussion and original sources.';
      candidates.querySelector(':scope > h2')?.insertAdjacentElement('afterend', deck);
    }
    const candidateCount = document.querySelectorAll('#candidateStrip .candidate-card').length || 5;
    const hero = document.createElement('section');
    hero.className = 'election-hero';
    hero.setAttribute('aria-labelledby', 'heroTitle');
    hero.innerHTML = `
      <div class="hero-copy">
        <div class="hero-kicker"><span class="hero-kicker-dot" aria-hidden="true"></span>2026 Burlington mayoral election</div>
        <h1 id="heroTitle">Burlington's mayoral election, explained.</h1>
        <p>See who is running, what they want to change, and what the public record shows.</p>
        <div class="hero-actions"><a class="hero-button hero-button-primary" href="#candidates">Meet the candidates</a><a class="hero-button hero-button-secondary" href="head-to-head.html">Compare candidates <span aria-hidden="true">→</span></a></div>
        <div class="hero-trust" aria-label="About this guide"><span>Independent</span><span>Plain language</span><span>Sources linked</span></div>
      </div>
      <div class="hero-visual" aria-hidden="true"><div class="hero-map-card"><div class="hero-map-grid"></div><div class="hero-water"></div><div class="hero-place-dot"></div><div class="hero-place-label"><strong>Burlington</strong><span>Ontario</span></div><div class="hero-lake-label">Lake Ontario</div><div class="hero-candidate-count"><strong>${candidateCount}</strong><span>mayoral candidates</span></div><div class="hero-date-card"><span>Election day</span><strong>OCT 26</strong><small>2026</small></div><div class="hero-voting-note"><span>Voting starts</span><strong>Oct. 14</strong></div></div></div>`;
    main.insertBefore(hero, candidates);
  }

  function monthDay(text) {
    const normalized = text.trim().replace('Sept.', 'Sep').replace('Oct.', 'Oct');
    const firstSpace = normalized.indexOf(' ');
    if (firstSpace === -1) return { month: '', day: normalized };
    return { month: normalized.slice(0, firstSpace).toUpperCase(), day: normalized.slice(firstSpace + 1) };
  }

  function upgradeDates() {
    const section = document.querySelector('section.dates#dates');
    if (!section || section.classList.contains('dates-upgraded')) return;
    const heading = section.querySelector('h2');
    const grid = section.querySelector('.date-grid');
    if (!heading || !grid) return;
    section.classList.add('dates-upgraded');

    const headingRow = document.createElement('div');
    headingRow.className = 'dates-heading-row';
    const headingCopy = document.createElement('div');
    headingCopy.className = 'dates-heading-copy';
    const accent = document.createElement('div');
    accent.className = 'dates-heading-accent';
    heading.textContent = 'Important dates';
    headingCopy.append(heading, accent);
    headingRow.append(headingCopy);
    section.insertBefore(headingRow, grid);

    const cards = Array.from(grid.querySelectorAll('.date-card'));
    grid.classList.add('date-timeline');
    cards.forEach((card, index) => {
      const date = card.querySelector('.date')?.textContent || '';
      const title = card.querySelector('h3')?.textContent || '';
      const description = card.querySelector('p')?.textContent || '';
      const { month, day } = monthDay(date);
      const kind = /debate/i.test(title) ? 'Public event' : /online/i.test(title) ? 'Online voting' : /advance/i.test(title) ? 'Advance voting' : 'Election day';
      card.className = `card date-card date-stop${index === 0 ? ' is-next' : ''}`;
      card.innerHTML = `<div class="date-stop-top"><div class="date-calendar" aria-hidden="true"><span class="date-calendar-month">${month}</span><span class="date-calendar-day">${day}</span></div><span class="date-status">${index === 0 ? 'Next' : 'Upcoming'}</span></div><div class="date-stop-body"><span class="date-kind">${kind}</span><h3>${title}</h3><p>${description}</p></div>`;
    });
  }

  function improvePageStructure() {
    const brand = document.querySelector('.brand');
    if (brand) brand.href = 'index.html';
    document.querySelectorAll('section').forEach((section) => {
      const heading = section.querySelector('h2');
      if (heading && !section.classList.contains('election-hero')) heading.classList.add('section-title');
    });
    const accessibilityHeading = Array.from(document.querySelectorAll('h2')).find((heading) => heading.textContent.trim() === 'Accessibility');
    if (accessibilityHeading?.parentElement) accessibilityHeading.parentElement.id = 'accessibility';
  }

  function ensureFooter() {
    let footer = document.querySelector('.site-legal-footer');
    if (!footer) { footer = document.createElement('footer'); footer.className = 'site-legal-footer'; document.body.appendChild(footer); }
    footer.innerHTML = `<div class="site-legal-footer-inner"><div class="footer-brand-block"><strong>Burlington Election Guide</strong><p>Independent civic project. Not affiliated with the City of Burlington, any candidate or campaign.</p></div><nav class="site-legal-links" aria-label="Legal and accessibility"><a href="help.html#accessibility">Accessibility</a><a href="terms.html">Terms of use</a><a href="privacy.html">Privacy policy</a></nav></div>`;
  }

  setTheme(preferredTheme(), false);
  document.addEventListener('DOMContentLoaded', () => {
    ensureExtraStyles();
    buildHero();
    upgradeDates();
    improvePageStructure();
    enhanceMenu();
    ensureFooter();
    setTheme(root.dataset.theme || preferredTheme(), false);
  });
})();
