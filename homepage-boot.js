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

  const start = () => {
    const kick = () => {
      loadScript('/site-search.js?v=20260827perf1');
      loadScript('/site-extra.js?v=20260827perf1');
      loadScript('/homepage-refinements.js?v=20260827perf1');
      loadScript('/weather-alert.js?v=20260827perf1');
      loadScript('/mobile-top-panel.js?v=20260827perf1');
      loadScript('/breaking-now.js?v=20260827perf1');
      loadScript('/home.js?v=20260827perf1', { module: true });
      loadScript('/local-now.js?v=20260827perf1', { module: true });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 1200 });
    else setTimeout(kick, 250);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
