import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, '..', 'theme-boot.js'), 'utf8');
const store = {};
const documentElement = { dataset: {}, style: {} };
let systemDark = false;
const context = {
  window: {},
  document: {
    documentElement,
    querySelectorAll: () => []
  },
  localStorage: {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; }
  },
  matchMedia: query => ({
    matches: String(query).includes('prefers-color-scheme: dark') ? systemDark : false,
    media: query,
    addEventListener: () => {},
    addListener: () => {}
  })
};
vm.createContext(context);
context.window = context;
vm.runInContext(code, context);

const theme = context.window.BurlingtonTheme;
let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', message);
  }
}

const noon = new Date('2026-08-26T16:00:00.000Z');
const times = theme.sunTimes(noon);
assert(times.sunriseMinutes < 8 * 60, `sunrise should be morning, got ${times.sunriseMinutes}`);
assert(times.sunsetMinutes > 18 * 60, `sunset should be evening, got ${times.sunsetMinutes}`);
assert(theme.isDaytime(noon) === true, 'Burlington noon is daytime');
assert(theme.THEME_KEY === 'burlington-news-theme', 'manual theme uses burlington-news-theme');
assert(theme.MODE_KEY === 'burlington-news-theme-mode', 'mode key is burlington-news-theme-mode');

function atLocalMinutes(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const utc = new Date(Date.UTC(2026, 7, 26, hour + 4, minute));
  const check = theme.sunTimes(utc);
  if (Math.abs(check.nowMinutes - minutes) > 1) {
    return new Date(Date.UTC(2026, 7, 26, hour + 5, minute));
  }
  return utc;
}

const thirtyBefore = atLocalMinutes(times.sunsetMinutes - 30);
const oneAfter = atLocalMinutes(times.sunsetMinutes + 1);
const beforeRise = atLocalMinutes(Math.max(0, times.sunriseMinutes - 20));
const afterRise = atLocalMinutes(times.sunriseMinutes + 5);

assert(theme.autoAppearance(thirtyBefore, 'dark') === 'light', 'day ignores system dark');
assert(theme.autoAppearance(thirtyBefore, 'light') === 'light', 'day stays light with system light');
assert(theme.autoAppearance(oneAfter, 'dark') === 'dark', 'night follows system dark');
assert(theme.autoAppearance(oneAfter, 'light') === 'light', 'night follows system light');
assert(theme.autoAppearance(beforeRise, 'dark') === 'dark', 'before sunrise follows system dark');
assert(theme.autoAppearance(beforeRise, 'light') === 'light', 'before sunrise follows system light');
assert(theme.autoAppearance(afterRise, 'dark') === 'light', 'after sunrise returns to light');

Object.keys(store).forEach(key => delete store[key]);
systemDark = true;
assert(theme.apply('auto', false, noon, 'dark') === 'light', 'DAY + no saved + system dark = LIGHT');
assert(theme.apply('auto', false, noon, 'light') === 'light', 'DAY + no saved + system light = LIGHT');
assert(theme.apply('auto', false, oneAfter, 'light') === 'light', 'NIGHT + no saved + system light = LIGHT');
assert(theme.apply('auto', false, oneAfter, 'dark') === 'dark', 'NIGHT + no saved + system dark = DARK');
assert(theme.apply('auto', false, beforeRise, 'dark') === 'dark', 'before sunrise + system dark = DARK');
assert(theme.apply('auto', false, afterRise, 'dark') === 'light', 'after sunrise + no saved = LIGHT');

theme.apply('dark', true, noon);
assert(documentElement.dataset.theme === 'dark', 'DAY + saved manual dark = DARK');
assert(theme.savedMode() === 'dark', 'manual dark is persisted');
assert(store[theme.THEME_KEY] === 'dark', 'manual dark stored on burlington-news-theme');

theme.apply('dark', true, oneAfter);
assert(documentElement.dataset.theme === 'dark', 'NIGHT + saved manual dark = DARK');

theme.apply('light', true, noon);
assert(documentElement.dataset.theme === 'light', 'DAY + saved manual light = LIGHT');
assert(store[theme.THEME_KEY] === 'light', 'manual light stored on burlington-news-theme');

theme.apply('light', true, oneAfter);
assert(documentElement.dataset.theme === 'light', 'NIGHT + saved manual light = LIGHT');
assert(theme.savedMode() === 'light', 'manual light is persisted');

theme.setAuto();
assert(theme.savedMode() === 'auto', 'setAuto returns to auto');
assert(!store[theme.THEME_KEY], 'auto clears the manual theme key');
assert(theme.apply('auto', true, noon, 'dark') === 'light', 'auto at noon is light even if system is dark');
assert(theme.apply('auto', true, oneAfter, 'dark') === 'dark', 'auto after sunset follows system dark');
assert(theme.apply('auto', true, oneAfter, 'light') === 'light', 'auto after sunset follows system light');

if (failed) {
  console.error(`${failed} theme-boot checks failed`);
  process.exit(1);
}
console.log('theme-boot matrix checks passed');
console.log(`Aug 26 2026 sunrise ${theme.formatClock(times.sunriseMinutes)}, sunset ${theme.formatClock(times.sunsetMinutes)}`);
