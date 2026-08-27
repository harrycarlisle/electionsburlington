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
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
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

    // Keep the first paint quiet. The HTML already contains complete static
    // fallbacks, so live data can enhance the page after it is usable.
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
