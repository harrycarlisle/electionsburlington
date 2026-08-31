import data from '../data/explore-events.json' with { type: 'json' };

const events = data.events;
const ids = new Set();
let failed = 0;
function fail(message) {
  console.error('FAIL', message);
  failed += 1;
}

if (events.length < 15) fail('inventory still too thin');
events.forEach(event => {
  if (ids.has(event.id)) fail('duplicate ' + event.id);
  ids.add(event.id);
  ['id', 'title', 'category', 'start', 'end', 'dateLabel', 'location', 'source', 'sourceName', 'scope', 'city', 'venue', 'verifiedAt', 'image'].forEach(key => {
    if (!event[key]) fail(event.id + ' missing ' + key);
  });
  if (event.scope !== 'Burlington') {
    if (event.visualText !== 'NEARBY') fail(event.id + ' nearby events need visualText NEARBY');
    if (!event.travel) fail(event.id + ' nearby events need travel context');
    if (event.city === 'Burlington') fail(event.id + ' nearby event marked as Burlington city');
  }
  if (new Date(event.end) < new Date(event.start)) fail(event.id + ' ends before it starts');
});

if (!ids.has('movies-under-the-stars-2026-09-03')) fail('next verified Thursday movie night missing');
if (events.some(event => /friday, august 28|aug\. 28.*movie/i.test(`${event.title} ${event.dateLabel}`))) {
  fail('unverified Friday movie night should not be added');
}
if (events.some(event => /paris night market|pirates of the caribbean/i.test(event.title))) {
  fail('past Paris movie night should not be in the upcoming pool');
}
if (ids.has('anchorball-rbg-2026')) fail('past June ANCHORBALL should not stay in upcoming');

if (failed) process.exit(1);
console.log('PASS', events.length, 'verified events');
