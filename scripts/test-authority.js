import events from '../data/explore-events.json' with { type: 'json' };
import developments from '../data/developments.json' with { type: 'json' };
import taxes from '../data/property-taxes-2026.json' with { type: 'json' };
import watch from '../data/event-watchlist-2027.json' with { type: 'json' };
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
function fail(message) {
  console.error('FAIL', message);
  failed += 1;
}

const requiredEvents = [
  'ribfest-2026',
  'royal-canadian-circus-2026',
  'bbcc-bums-regatta-2026',
  'burlington-asian-night-market-2026',
  'babysitters-club-bpac-2026',
  'nickel-brook-beer-fest-2026',
  'wander-culture-days-2026',
  'santa-claus-parade-2026'
];
const ids = new Set(events.events.map(event => event.id));
requiredEvents.forEach(id => {
  if (!ids.has(id)) fail('missing event ' + id);
});
if (events.events.some(event => /dining al fresco/i.test(event.title))) {
  fail('past or unsourced Dining Al Fresco should not be added as upcoming');
}

const leaf = events.events.filter(event => event.slug);
if (leaf.length < 10) fail('not enough event leaf slugs');
leaf.forEach(event => {
  const path = join(process.cwd(), 'events', event.slug, 'index.html');
  if (!existsSync(path)) fail('missing leaf page ' + event.slug);
});

['1200-king', 'aldershot-toc', 'data-centre-3110', 'millcroft-phase-2', '730-brant'].forEach(id => {
  if (!developments.projects.some(project => project.id === id)) fail('missing development ' + id);
});

if (taxes.overallIncreasePercent !== 4.5) fail('tax increase should match City 4.50%');
if (taxes.increasePer100kCva !== 43.71) fail('tax dollar increase should match City $43.71');

const invented = watch.events.filter(item => item.status === 'confirmed' && !item.date);
if (invented.length) fail('watchlist confirmed without a date');
if (!watch.events.every(item => item.status)) fail('watchlist missing status');

[
  'elections/compare/index.html',
  'elections/ward/index.html',
  'go/burlington-to-union/index.html',
  'development/index.html',
  'taxes/index.html',
  'parking/index.html',
  'beach/index.html',
  'editorial-standards/index.html',
  'ai-policy/index.html',
  'corrections/index.html',
  'sources/index.html',
  'accessibility/index.html',
  'events/index.html',
  'elections/ballot/index.html',
  'elections/head-to-head/index.html'
].forEach(file => {
  if (!existsSync(join(process.cwd(), file))) fail('missing page ' + file);
});

if (failed) process.exit(1);
console.log('PASS authority', leaf.length, 'event leaves', developments.projects.length, 'projects');
