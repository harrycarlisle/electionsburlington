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
      button.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
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

  function buildNavTools(nav) {
    if (!nav || nav.querySelector('.nav-tools')) return;

    const help = document.createElement('a');
    help.href = 'help.html';
    help.textContent = 'Help & feedback';

    const privacy = document.createElement('a');
    privacy.href = 'privacy.html';
    privacy.textContent = 'Privacy';

    const terms = document.createElement('a');
    terms.href = 'terms.html';
    terms.textContent = 'Terms';

    const tools = document.createElement('div');
    tools.className = 'nav-tools';
    tools.setAttribute('aria-label', 'Site tools');

    const language = document.createElement('select');
    language.className = 'language-select';
    language.setAttribute('aria-label', 'Translate this page');
    language.innerHTML = `
      <option value="">Translate</option>
      <option value="fr">Français</option>
      <option value="zh-CN">中文</option>
      <option value="pa">ਪੰਜਾਬੀ</option>
      <option value="es">Español</option>
      <option value="ar">العربية</option>
      <option value="hi">हिन्दी</option>`;
    language.addEventListener('change', () => {
      if (!language.value) return;
      window.location.assign(translateUrl(language.value));
    });

    const theme = document.createElement('button');
    theme.type = 'button';
    theme.className = 'nav-action';
    theme.dataset.themeToggle = '';
    theme.addEventListener('click', () => {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    nav.append(help, privacy, terms);
    tools.append(language, theme);
    nav.append(tools);
  }

  function enhanceMenu() {
    const menu = document.getElementById('menuBtn');
    const nav = document.getElementById('mainNav');
    if (!menu || !nav) return;

    buildNavTools(nav);

    // Preserve the site's existing menu handler. This only adds close-on-link and Escape behavior.
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 720) {
          nav.classList.remove('open');
          menu.setAttribute('aria-expanded', 'false');
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.focus();
      }
    });
  }

  setTheme(preferredTheme(), false);
  document.addEventListener('DOMContentLoaded', () => {
    enhanceMenu();
    setTheme(root.dataset.theme || preferredTheme(), false);
  });
})();
