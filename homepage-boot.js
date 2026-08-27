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

  let started = false;
  const start = () => {
    if (started) return;
    started = true;

    // Do not wait for window.load. A slow image or stylesheet should never
    // prevent the live homepage controls from starting.
    setTimeout(() => {
      loadScript('/site-search.js?v=20260827perf1');
      loadScript('/site-extra.js?v=20260827perf1');
      loadScript('/homepage-refinements.js?v=20260827perf1');
      loadScript('/weather-alert.js?v=20260827perf1');
      loadScript('/mobile-top-panel.js?v=20260827perf1');
      loadScript('/breaking-now.js?v=20260827perf1');
      loadScript('/home.js?v=20260827perf1', { module: true });
      loadScript('/local-now.js?v=20260827perf1', { module: true });
    }, 40);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Last-resort safety in case a browser extension or malformed resource
  // interferes with DOMContentLoaded in an unusual environment.
  setTimeout(start, 1500);
})();
