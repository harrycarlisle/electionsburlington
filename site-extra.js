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

  function themeIcon(theme) {
    if (theme === 'dark') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.7 8.7 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only">Dark mode</span>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Light mode</span>';
  }

  function setTheme(theme, persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      button.innerHTML = themeIcon(next);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
    if (persist) {
      try { localStorage.setItem(storageKey, next); } catch (_) {}
    }
  }

  function isHomePage() {
    const path = window.location.pathname;
    return path === '/' || path.endsWith('/index.html') || path.endsWith('electionsburlington.ca');
  }

  function homeLink(hash) {
    return isHomePage() ? hash : `index.html${hash}`;
  }

  function ensureExtraStyles() {
    const styles = [
      ['dates-extra.css?v=20260823c', 'electionDates'],
      ['header-controls.css?v=20260823b', 'headerControls'],
      ['polish-v2.css?v=20260823a', 'polishV2']
    ];
    styles.forEach(([href, key]) => {
      const dataName = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      if (document.querySelector(`link[data-${dataName}]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset[key] = '';
      document.head.appendChild(link);
    });
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
      </div>`;
  }

  function prepareHeaderForMenu() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner || document.getElementById('menuBtn')) return;
    headerInner.querySelector('.back')?.remove();
    const nav = document.createElement('nav');
    nav.className = 'nav';
    nav.id = 'mainNav';
    nav.setAttribute('aria-label', 'Primary');
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'menu';
    menu.id = 'menuBtn';
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-controls', 'mainNav');
    menu.textContent = 'Menu';
    headerInner.append(nav, menu);
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

    const theme = document.createElement('button');
    theme.type = 'button';
    theme.className = 'theme-icon-button';
    theme.dataset.themeToggle = '';
    theme.addEventListener('click', (event) => {
      event.stopPropagation();
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    const controls = document.createElement('div');
    controls.className = 'header-controls';
    menu.parentElement.insertBefore(controls, menu);
    controls.append(theme, menu);

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
    candidates.querySelector(':scope > .section-deck')?.remove();
    const originalHeading = candidates.querySelector(':scope > h1');
    if (originalHeading) {
      const h2 = document.createElement('h2');
      h2.textContent = 'Meet the candidates';
      originalHeading.replaceWith(h2);
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

  function localDay(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 12, 0, 0, 0);
  }

  function daysBetween(from, to) {
    const a = localDay(from.getFullYear(), from.getMonth(), from.getDate());
    return Math.round((to - a) / 86400000);
  }

  function countdownFor(title) {
    const now = new Date();
    const today = localDay(now.getFullYear(), now.getMonth(), now.getDate());
    let target;
    let end;

    if (/debate/i.test(title)) target = localDay(2026, 8, 17);
    else if (/online/i.test(title)) { target = localDay(2026, 9, 14); end = localDay(2026, 9, 23); }
    else if (/advance/i.test(title)) {
      const first = localDay(2026, 9, 17);
      const second = localDay(2026, 9, 20);
      if (today > first && today < second) target = second;
      else if (today === first || today === second) return 'Today';
      else if (today > second) return 'Finished';
      else target = first;
    } else target = localDay(2026, 9, 26);

    if (end && today >= target && today <= end) return today.getTime() === end.getTime() ? 'Ends today' : `Ends in ${daysBetween(today, end)} days`;
    const days = daysBetween(today, target);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Finished';
    return `In ${days} days`;
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
      const status = countdownFor(title);
      const active = !/Finished/i.test(status) && index === cards.findIndex((c) => !/Finished/i.test(countdownFor(c.querySelector('h3')?.textContent || '')));
      card.className = `card date-card date-stop${active ? ' is-next' : ''}`;
      card.innerHTML = `<div class="date-stop-top"><div class="date-calendar" aria-hidden="true"><span class="date-calendar-month">${month}</span><span class="date-calendar-day">${day}</span></div><span class="date-status">${status}</span></div><div class="date-stop-body"><h3>${title}</h3><p>${description}</p></div>`;
    });
  }

  function simplifyLabels() {
    document.querySelectorAll('.meaning-detail summary,.plain summary').forEach((summary) => {
      if (/what does that mean/i.test(summary.textContent)) summary.textContent = 'In plain English';
    });
  }

  function simplifyMainPage() {
    document.querySelector('.site-independent-note')?.remove();
    const oldFooterNote = document.querySelector('.footer');
    if (oldFooterNote) oldFooterNote.remove();
  }

  function polishHeadToHead() {
    const matchGrid = document.querySelector('.match-grid');
    if (!matchGrid) return;
    document.body.classList.add('h2h-polished');
    document.querySelector('.head p')?.remove();
    document.querySelector('.back')?.remove();

    const context = document.getElementById('context');
    const issue = document.getElementById('issue');
    const demoteContext = () => {
      const heading = context?.querySelector('h2');
      if (heading) heading.textContent = 'Context';
      simplifyLabels();
    };
    demoteContext();
    issue?.addEventListener('change', () => setTimeout(demoteContext, 0));
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
    simplifyMainPage();
    polishHeadToHead();
    improvePageStructure();
    prepareHeaderForMenu();
    enhanceMenu();
    simplifyLabels();
    ensureFooter();
    setTheme(root.dataset.theme || preferredTheme(), false);
  });
})();
