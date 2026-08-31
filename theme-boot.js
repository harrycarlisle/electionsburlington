(() => {
  const THEME_KEY = 'burlington-news-theme';
  const MODE_KEY = 'burlington-news-theme-mode';
  const LAT = 43.3255;
  const LON = -79.7990;
  const BRAND_TAB_ICON = '/assets/brand/favicon-32x32.png?v=20260830logo1';
  const BRAND_SMALL_ICON = '/assets/brand/favicon-16x16.png?v=20260830logo1';
  const BRAND_TOUCH_ICON = '/assets/brand/apple-touch-icon.png?v=20260830logo1';
  const NAV_STYLE = '/site-nav-traffic-fixes.css?v=20260829nav5';

  function syncNavStyle() {
    const head = document.head;
    if (!head) return;
    const links = [...head.querySelectorAll('link[rel="stylesheet"]')]
      .filter(link => (link.getAttribute('href') || '').includes('/site-nav-traffic-fixes.css'));
    if (!links.length) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = NAV_STYLE;
      link.dataset.style = 'site-nav-traffic-fixes';
      head.appendChild(link);
      return;
    }
    links.forEach(link => {
      if (link.getAttribute('href') !== NAV_STYLE) link.setAttribute('href', NAV_STYLE);
      link.dataset.style = 'site-nav-traffic-fixes';
    });
  }

  function syncBrandIcons() {
    const head = document.head;
    if (!head) return;
    const iconLinks = [...head.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]')];
    if (!iconLinks.length) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/png';
      icon.href = BRAND_TAB_ICON;
      head.appendChild(icon);
    } else {
      iconLinks.forEach(icon => {
        const target = icon.getAttribute('sizes') === '16x16' ? BRAND_SMALL_ICON : BRAND_TAB_ICON;
        if (icon.getAttribute('href') !== target) icon.setAttribute('href', target);
        icon.setAttribute('type', 'image/png');
      });
    }
    head.querySelectorAll('link[rel="apple-touch-icon"]').forEach(icon => {
      if (icon.getAttribute('href') !== BRAND_TOUCH_ICON) icon.setAttribute('href', BRAND_TOUCH_ICON);
    });
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function torontoParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const get = type => Number(parts.find(part => part.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
  }

  function julianDay(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const a = Math.floor(year / 100);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + (2 - a + Math.floor(a / 4)) - 1524.5;
  }

  function sunEventHours(year, month, day, rising) {
    const jday = julianDay(year, month, day);
    const n = Math.round(jday - 2451545 + 0.0008);
    const jStar = n - (LON / 360);
    const m = (357.5291 + 0.98560028 * jStar) % 360;
    const mRad = m * Math.PI / 180;
    const c = 1.9148 * Math.sin(mRad) + 0.02 * Math.sin(2 * mRad) + 0.0003 * Math.sin(3 * mRad);
    const lambda = (m + c + 180 + 102.9372) % 360;
    const lambdaRad = lambda * Math.PI / 180;
    const jTransit = 2451545 + jStar + 0.0053 * Math.sin(mRad) - 0.0069 * Math.sin(2 * lambdaRad);
    const sinDec = Math.sin(lambdaRad) * Math.sin(23.44 * Math.PI / 180);
    const dec = Math.asin(sinDec);
    const latRad = LAT * Math.PI / 180;
    const cosH = (Math.sin(-0.83 * Math.PI / 180) - Math.sin(latRad) * sinDec) / (Math.cos(latRad) * Math.cos(dec));
    if (cosH < -1 || cosH > 1) return rising ? 0 : 24;
    const h = Math.acos(cosH) * 180 / Math.PI;
    const jEvent = jTransit + (rising ? -h : h) / 360;
    const utcHours = ((jEvent + 0.5) % 1) * 24;
    return utcHours;
  }

  function utcHoursToTorontoMinutes(year, month, day, utcHours) {
    const utc = Date.UTC(year, month - 1, day, Math.floor(utcHours), Math.round((utcHours % 1) * 60));
    const local = torontoParts(new Date(utc));
    return local.hour * 60 + local.minute;
  }

  function sunTimes(date = new Date()) {
    const local = torontoParts(date);
    const riseUtc = sunEventHours(local.year, local.month, local.day, true);
    const setUtc = sunEventHours(local.year, local.month, local.day, false);
    return {
      sunriseMinutes: utcHoursToTorontoMinutes(local.year, local.month, local.day, riseUtc),
      sunsetMinutes: utcHoursToTorontoMinutes(local.year, local.month, local.day, setUtc),
      nowMinutes: local.hour * 60 + local.minute
    };
  }

  function isDaytime(date = new Date()) {
    const times = sunTimes(date);
    return times.nowMinutes >= times.sunriseMinutes && times.nowMinutes < times.sunsetMinutes;
  }

  function systemAppearance() {
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  }

  function autoAppearance(date = new Date(), system) {
    if (isDaytime(date)) return 'light';
    return (system || systemAppearance()) === 'dark' ? 'dark' : 'light';
  }

  function savedMode() {
    try {
      const mode = localStorage.getItem(MODE_KEY);
      if (mode === 'auto' || mode === 'light' || mode === 'dark') return mode;
      const legacy = localStorage.getItem(THEME_KEY);
      if (legacy === 'light' || legacy === 'dark') return legacy;
    } catch (_) {}
    return 'auto';
  }

  function appearanceFrom(mode, date, system) {
    if (mode === 'light' || mode === 'dark') return mode;
    return autoAppearance(date, system);
  }

  function paintButtons(appearance, mode) {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const target = appearance === 'dark' ? 'light' : 'dark';
      const label = target === 'dark' ? 'Dark mode' : 'Light mode';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.dataset.themeMode = mode;
    });
  }

  function apply(mode = savedMode(), persist = false, date, system) {
    const appearance = appearanceFrom(mode, date, system);
    const root = document.documentElement;
    root.dataset.theme = appearance;
    root.dataset.themeMode = mode;
    root.style.colorScheme = appearance;
    if (persist) {
      try {
        localStorage.setItem(MODE_KEY, mode);
        if (mode === 'auto') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, mode);
      } catch (_) {}
    }
    paintButtons(appearance, mode);
    return appearance;
  }

  function toggleManual() {
    const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
    return apply(next, true);
  }

  function setAuto() {
    return apply('auto', true);
  }

  window.BurlingtonTheme = {
    THEME_KEY,
    MODE_KEY,
    sunTimes,
    isDaytime,
    systemAppearance,
    autoAppearance,
    savedMode,
    apply,
    toggleManual,
    setAuto,
    formatClock(minutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
      return `${hour % 12 || 12}:${pad(minute)} ${suffix}`;
    }
  };

  syncNavStyle();
  syncBrandIcons();
  if (typeof MutationObserver === 'function' && document.head) {
    const headAssetObserver = new MutationObserver(() => {
      syncNavStyle();
      syncBrandIcons();
    });
    headAssetObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  apply(savedMode(), false);

  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (savedMode() === 'auto') apply('auto', false);
    });
  } catch (_) {}
})();
