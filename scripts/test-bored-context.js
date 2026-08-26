const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/explore-events.json'), 'utf8'));
const store = {};
const sandbox = {
  window: {},
  document: { getElementById: () => null },
  localStorage: {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); }
  },
  fetch: async () => ({ ok: true, json: async () => data }),
  location: { hash: '' },
  matchMedia: () => ({ matches: true }),
  console,
  Date,
  Intl,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  Set,
  Boolean
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'explore-ideas.js'), 'utf8'), sandbox, { filename: 'explore-ideas.js' });

const ideas = sandbox.BurlingtonIdeas;
ideas.setIdeas(data.boredIdeas);
ideas.setEvents(data.events);

function ctx(overrides = {}) {
  const hour = overrides.hour ?? 14;
  const minute = overrides.minute ?? 0;
  const date = overrides.date || '2026-08-26';
  const weekday = overrides.weekday || 'Wed';
  const [year, month, day] = date.split('-').map(Number);
  const iso = `${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00-04:00`;
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    date,
    ms: Date.parse(iso),
    sunrise: Date.parse(`${date}T06:20:00-04:00`),
    sunset: Date.parse(`${date}T20:05:00-04:00`),
    dark: Boolean(overrides.dark),
    lateNight: Boolean(overrides.lateNight),
    season: overrides.season || 'summer',
    weekend: weekday === 'Sat' || weekday === 'Sun',
    weather: {
      raining: false,
      storm: false,
      snow: false,
      heat: false,
      clear: true,
      ...(overrides.weather || {})
    },
    alerts: { thunderstorm: false, severe: false, ...(overrides.alerts || {}) }
  };
}

function ids(context) {
  ideas.setContext(context);
  return ideas.eligible(context).map(item => item.id);
}

function has(list, id) { return list.includes(id); }
function fail(message) { console.error('FAIL', message); process.exitCode = 1; }
function pass(name) { console.log('PASS', name); }

const isolated = ['burloak-path', 'beachway-walk', 'kerncliff-boardwalk', 'mount-nemo-lookout', 'fishway-visit'];

{
  const list = ids(ctx({ hour: 14, dark: false, season: 'summer', weather: { clear: true } }));
  if (isolated.every(id => has(list, id))) pass('A daylight outdoor eligible');
  else fail('A missing outdoor ideas: ' + isolated.filter(id => !has(list, id)));
}

{
  const list = ids(ctx({ hour: 20, minute: 30, dark: true, lateNight: false, weekday: 'Wed' }));
  if (isolated.every(id => !has(list, id))) pass('B after dark excludes isolated outdoor');
  else fail('B still recommending isolated: ' + isolated.filter(id => has(list, id)));
}

{
  const list = ids(ctx({ hour: 22, minute: 30, dark: true, lateNight: true }));
  const bad = list.filter(id => isolated.includes(id) || id === 'rbg-walk' || id === 'jcs-bagels');
  const good = list.some(id => ['cineplex-mapleview', 'village-square-evening', 'moon-over-lake-ontario', 'public-art-three'].includes(id));
  if (!bad.length && good) pass('C late night keeps staffed/night options');
  else fail('C late night pool wrong: ' + list.join(', ') + ' bad=' + bad.join(','));
}

{
  const list = ids(ctx({ hour: 14, weather: { raining: true, clear: false } }));
  if (isolated.every(id => !has(list, id)) && has(list, 'jcs-bagels')) pass('D rain removes exposed outdoor');
  else fail('D rain filter failed: ' + list.join(', '));
}

{
  const list = ids(ctx({ hour: 14, alerts: { thunderstorm: true }, weather: { storm: true, clear: false } }));
  const outdoor = list.filter(id => isolated.includes(id) || id === 'pier-sunset' || id === 'burloak-path');
  if (!outdoor.length) pass('E thunderstorm blocks exposed outdoor');
  else fail('E still showing outdoor: ' + outdoor.join(', '));
}

{
  const list = ids(ctx({
    date: '2026-09-04',
    weekday: 'Fri',
    hour: 20,
    minute: 30,
    dark: true,
    lateNight: false
  }));
  if (has(list, 'event-ribfest-2026')) pass('F public evening festival eligible');
  else fail('F missing live festival: ' + list.join(', '));
}

{
  const list = ids(ctx({
    date: '2026-08-27',
    weekday: 'Thu',
    hour: 22,
    minute: 40,
    dark: true,
    lateNight: true
  }));
  if (has(list, 'eclipse-tonight') && !has(list, 'mount-nemo-lookout')) pass('G eclipse allowed at public waterfront');
  else fail('G eclipse/location failed: ' + list.join(', '));
}

{
  const closed = ctx({ hour: 16, minute: 0 });
  ideas.setContext(closed);
  const bagel = data.boredIdeas.find(item => item.id === 'jcs-bagels');
  if (ideas.openState(bagel, closed) === false && !has(ids(closed), 'jcs-bagels')) pass('H closed restaurant excluded');
  else fail('H bagel still recommended after close');
}

{
  const hiking = data.boredIdeas.find(item => item.id === 'mount-nemo-lookout');
  ideas.setPref('mount-nemo-lookout', { skip: true });
  ideas.setPref('kerncliff-boardwalk', { skip: true });
  const daylight = ctx({ hour: 14, dark: false, weather: { clear: true } });
  ideas.setContext(daylight);
  const trailScore = ideas.scoreIdea(hiking, daylight);
  const bagelScore = ideas.scoreIdea(data.boredIdeas.find(item => item.id === 'jcs-bagels'), daylight);
  if (trailScore === 0 && bagelScore > trailScore) pass('I hiking skips downrank trail ideas');
  else fail('I skip affinity failed trail=' + trailScore + ' bagel=' + bagelScore);
}

{
  const burloak = data.boredIdeas.find(item => item.id === 'burloak-path');
  const url = ideas.mapsUrl(burloak);
  if (decodeURIComponent(url).includes('Burloak Waterfront Park')) pass('Maps query uses place name');
  else fail('Maps query wrong: ' + url);
}

if (!process.exitCode) console.log('All bored-context scenarios passed.');
