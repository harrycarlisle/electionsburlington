import assert from 'node:assert/strict';
import data from '../data/explore-events.json' with { type: 'json' };
import { expandRecurringEvent, mergeExploreEvents, marketOnDate, FARMERS_MARKET_RECURRENCE } from '../lib/explore-recurrence.mjs';

const instances = expandRecurringEvent(FARMERS_MARKET_RECURRENCE);
const byId = Object.fromEntries(instances.map(item => [item.id, item]));

assert.ok(byId['burlington-farmers-market-2026-08-26'], 'Wed Aug 26 exists');
assert.match(byId['burlington-farmers-market-2026-08-26'].dateLabel, /Evening market/);
assert.equal(byId['burlington-farmers-market-2026-08-26'].end.startsWith('2026-08-26T19:30'), true);

assert.ok(byId['burlington-farmers-market-2026-08-28'], 'Fri Aug 28 exists');
assert.equal(/Evening market/.test(byId['burlington-farmers-market-2026-08-28'].dateLabel), false);
assert.equal(byId['burlington-farmers-market-2026-08-28'].end.startsWith('2026-08-28T14:30'), true);

assert.ok(byId['burlington-farmers-market-2026-08-29'], 'Sat Aug 29 exists');
assert.equal(instances.some(item => item.start.startsWith('2026-08-27')), false, 'Thu Aug 27 has no market');
assert.equal(instances.some(item => item.start.startsWith('2026-10-25')), false, 'after Oct 24 no 2026 instances');
assert.ok(byId['burlington-farmers-market-2026-05-20']);
assert.equal(/Evening market/.test(byId['burlington-farmers-market-2026-05-20'].dateLabel), false, 'May 20 is before evening season');
assert.ok(byId['burlington-farmers-market-2026-06-03']);
assert.match(byId['burlington-farmers-market-2026-06-03'].dateLabel, /Evening market/);

const merged = mergeExploreEvents(data);
assert.equal(marketOnDate(merged, '2026-08-26').length, 1);
assert.equal(merged.some(event => event.id === 'lions-market-2026-08-26'), false);
assert.ok(merged.length > data.events.length);

console.log('PASS', instances.length, 'market dates');
