(() => {
  const loadScript = (src, opts = {}) => new Promise(resolve => {
    const s = document.createElement('script');
    s.src = src;
    if (opts.module) s.type = 'module';
    s.async = true;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });

  const setupMenu = () => {
    const btn = document.getElementById('menuBtn');
    const nav = document.getElementById('mainNav');
    if (!btn || !nav) return;

    nav.className = 'nav menu-panel';
    nav.innerHTML = '<div class="menu-primary" role="list"><a class="menu-link is-active" role="listitem" href="/" aria-current="page"><span>Home</span></a><a class="menu-link" role="listitem" href="/news/"><span>News</span></a><a class="menu-link" role="listitem" href="/elections/"><span>Elections</span></a><a class="menu-link" role="listitem" href="/explore/"><span>Explore</span></a><a class="menu-link" role="listitem" href="/sports/"><span>Sports</span></a><a class="menu-link" role="listitem" href="/games/"><span>Puzzles</span></a></div><div class="menu-primary menu-secondary" role="list"><a class="menu-link menu-secondary-link" role="listitem" href="/traffic/"><span>Traffic</span></a><a class="menu-link menu-secondary-link" role="listitem" href="/go/"><span>GO</span></a><a class="menu-link menu-secondary-link" role="listitem" href="/development/"><span>Development</span></a><a class="menu-link menu-secondary-link" role="listitem" href="/about/"><span>About</span></a></div>';

    const close = () => {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open site menu');
      nav.classList.remove('open');
      document.documentElement.classList.remove('menu-is-open');
      document.body.classList.remove('menu-is-open');
    };
    const open = () => {
      const header = document.querySelector('.header, .site-header');
      const bottom = Math.ceil(header?.getBoundingClientRect().bottom || 0);
      document.documentElement.style.setProperty('--mobile-menu-top', `${bottom + 8}px`);
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close site menu');
      nav.classList.add('open');
      document.documentElement.classList.add('menu-is-open');
      document.body.classList.add('menu-is-open');
    };

    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (btn.getAttribute('aria-expanded') === 'true') close();
      else open();
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
  };

  const setupLazySearch = () => {
    const input = document.getElementById('siteSearch');
    if (!input) return;
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      loadScript('/site-search.js?v=20260827perf2');
    };
    input.addEventListener('focus', load, { once: true });
    input.addEventListener('pointerdown', load, { once: true });
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setupMenu();
    setupLazySearch();

    setTimeout(() => {
      loadScript('/mobile-top-panel.js?v=20260827perf2');
      loadScript('/local-now.js?v=20260827perf2', { module: true });
      loadScript('/breaking-now.js?v=20260827perf2');
    }, 700);

    setTimeout(() => {
      loadScript('/home.js?v=20260827perf2', { module: true });
    }, 1800);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
