(() => {
  const FALLBACK_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  const FALLBACK_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';

  function ensureFallback() {
    if (window.L || document.querySelector('script[data-leaflet-fallback]')) return;

    if (!document.querySelector('link[data-leaflet-fallback]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = FALLBACK_CSS;
      css.dataset.leafletFallback = '1';
      document.head.appendChild(css);
    }

    const script = document.createElement('script');
    script.src = FALLBACK_JS;
    script.async = true;
    script.dataset.leafletFallback = '1';
    document.head.appendChild(script);
  }

  window.setTimeout(ensureFallback, 1200);
})();
