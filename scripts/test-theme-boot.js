import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, '..', 'theme-boot.js'), 'utf8');
const store = {};
const documentElement = { dataset: {}, style: {} };
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
  }
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
assert(theme.autoAppearance(noon) === 'light', 'Burlington noon is light');

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

assert(theme.autoAppearance(thirtyBefore) === 'light', '30 minutes before sunset is light');
assert(theme.autoAppearance(oneAfter) === 'dark', '1 minute after sunset is dark');
assert(theme.autoAppearance(beforeRise) === 'dark', 'before sunrise is dark');
assert(theme.autoAppearance(afterRise) === 'light', 'after sunrise is light');

theme.apply('dark', true, noon);
assert(documentElement.dataset.theme === 'dark', 'manual dark during day stays dark');
assert(theme.savedMode() === 'dark', 'manual dark is persisted');

theme.apply('light', true, oneAfter);
assert(documentElement.dataset.theme === 'light', 'manual light at night stays light');
assert(theme.savedMode() === 'light', 'manual light is persisted');

theme.setAuto();
assert(theme.savedMode() === 'auto', 'setAuto returns to auto');
assert(theme.apply('auto', true, noon) === 'light', 'auto at noon is light');
assert(theme.apply('auto', true, oneAfter) === 'dark', 'auto after sunset is dark');

if (failed) {
  console.error(`${failed} theme-boot checks failed`);
  process.exit(1);
}
console.log('theme-boot sunrise/sunset and override checks passed');
console.log(`Aug 26 2026 sunrise ${theme.formatClock(times.sunriseMinutes)}, sunset ${theme.formatClock(times.sunsetMinutes)}`);
