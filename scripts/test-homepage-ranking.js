import {
  canLabelMostRead,
  effectiveFreshnessTimestamp,
  popularityScore,
  relativeTime,
  selectNewest,
  uniqueCameraCount
} from '../lib/homepage-ranking.js';
import {readFileSync} from 'node:fs';

let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', message);
  }
}

const now = Date.parse('2026-08-26T15:00:00-04:00');
const stories = [
  {id: 'a', topic: 'schools', publishedAt: '2026-08-26T14:48:00-04:00'},
  {id: 'b', topic: 'development', publishedAt: '2026-08-26T13:30:00-04:00'},
  {id: 'c', topic: 'food', publishedAt: '2026-08-26T10:15:00-04:00'},
  {id: 'd', topic: 'history', publishedAt: '2026-08-25T20:00:00-04:00'}
];

const full = selectNewest(stories, {now, limit: 3});
assert(full.items.map(item => item.id).join(',') === 'a,b,c', `6-hour window kept afternoon stories: ${full.items.map(item => item.id)}`);
assert(!full.items.some(item => item.id === 'd'), 'yesterday is excluded from Newest');
assert(full.diversityChangedOrder === false, 'same-order when categories already differ');

const thin = selectNewest([stories[1], stories[3]], {now, limit: 3});
assert(thin.items.map(item => item.id).join(',') === 'b', `do not fill with yesterday: ${thin.items.map(item => item.id)}`);

const sameCat = selectNewest([
  {id: 'new-dev', topic: 'development', publishedAt: '2026-08-26T14:50:00-04:00'},
  {id: 'old-dev', topic: 'development', publishedAt: '2026-08-26T14:40:00-04:00'},
  {id: 'food', topic: 'food', publishedAt: '2026-08-26T14:20:00-04:00'}
], {now, limit: 2});
assert(sameCat.items[0].id === 'new-dev', 'newest story still leads');
assert(sameCat.items[1].id === 'food', 'diversity may break a same-category tie within 90 minutes');

const staleDiversity = selectNewest([
  {id: 'fresh', topic: 'development', publishedAt: '2026-08-26T14:30:00-04:00'},
  {id: 'five-hours', topic: 'food', publishedAt: '2026-08-26T10:00:00-04:00'}
], {now, limit: 2});
assert(staleDiversity.items[0].id === 'fresh', 'a 5-hour-old story cannot outrank a 30-minute-old story');

assert(relativeTime('2026-08-26T14:36:00-04:00', now) === '24 min ago', relativeTime('2026-08-26T14:36:00-04:00', now));
assert(relativeTime('2026-08-26T11:00:00-04:00', now) === '4 hours ago', relativeTime('2026-08-26T11:00:00-04:00', now));
assert(relativeTime('2026-08-25T20:00:00-04:00', now) === 'Yesterday', relativeTime('2026-08-25T20:00:00-04:00', now));
assert(relativeTime('2026-08-27T15:00:00-04:00', now) === '', 'no future timestamps');
assert(effectiveFreshnessTimestamp({published: '2026-08-25', lastMeaningfulUpdate: '2026-08-26T14:00:00-04:00'}) === Date.parse('2026-08-26T14:00:00-04:00'), 'meaningful update wins');

const empty = selectNewest(stories.map(item => ({...item, publishedAt: '2026-08-24T12:00:00-04:00'})), {now});
assert(empty.items.length === 0, 'stale catalog hides Newest');

const popularA = popularityScore({reads1h: 40, reads6h: 80, reads24h: 90, firstSeen: now - 45 * 60000, lastSeen: now}, 50, now);
const popularB = popularityScore({reads1h: 2, reads6h: 10, reads24h: 900, firstSeen: now - 20 * 3600000, lastSeen: now - 8 * 3600000}, 50, now);
assert(popularA > popularB, 'recent velocity outranks lifetime reads');
assert(canLabelMostRead(12) === false, 'cold start cannot be called Most Read');
assert(canLabelMostRead(40) === true, 'mature sample can use a readership label');
assert(uniqueCameraCount([{viewId: 1}, {cameraId: 1}, {viewId: 2}]) === 2, 'unique cameras');

const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const breakingArchive = JSON.parse(readFileSync(new URL('../data/breaking-archive.json', import.meta.url), 'utf8'));
const exploreMarkup = homepage.match(/<section class="explore-band"[\s\S]*?<\/section>/)?.[0] || '';
assert(/id="breakingNow"[^>]*data-state="local-update"/.test(homepage), 'homepage ships with a visible Local Update rail');
assert(/id="breakingNow"[\s\S]*?Nationalist conference moved to Burlington after two Hamilton venues cancelled/.test(homepage), 'newest verified Burlington development replaces the older Ghent update');
assert(/id="breakingNow"[\s\S]*?TODAY/.test(homepage), 'new local update is clearly dated today');
assert(/class="top-story" data-story-id="domcon-2026-burlington-atrium"[\s\S]*?IMG_5125\.jpeg/.test(homepage), 'homepage lead preserves the newer local-affairs story with the original Atrium photograph');
assert(/id="latestList"[\s\S]*?data-story-id="burlington-recycling-pilot-1971"/.test(homepage), 'published feature appears in the homepage Latest rail');
assert(breakingArchive.items?.[0]?.id === 'domcon-2026-burlington-atrium', 'live Local Update data advances to the DomCon Burlington story');
assert(/class="pick-grid"/.test(exploreMarkup) && /class="pick-card"/.test(exploreMarkup), 'Explore reuses Top Picks grid and card markup');
assert(!/explore-home-card|explore-home-grid|explore-intro|explore-heading/.test(exploreMarkup), 'legacy Explore-only presentation is absent');
assert(/<footer class="site-legal-footer">/.test(homepage), 'homepage uses the shared publication footer');
assert(!/<footer class="site-footer">/.test(homepage), 'legacy homepage footer is absent');

const exploreLive = readFileSync(new URL('../homepage-explore-live.js', import.meta.url), 'utf8');
assert(/class="pick-card"/.test(exploreLive), 'live Explore cards preserve Top Picks markup');

const siteExtra = readFileSync(new URL('../site-extra.js', import.meta.url), 'utf8');
const footerFunction = siteExtra.match(/function ensureFooter\(\)[\s\S]*?\n  }/)?.[0] || '';
assert(!/if \(isHome\(\)\) return/.test(footerFunction), 'shared footer updater runs on the homepage');

if (failed) {
  console.error(`${failed} homepage ranking checks failed`);
  process.exit(1);
}
console.log('homepage ranking checks passed');
console.log(JSON.stringify({
  newestAt3pm: full.items.map((item, index) => ({
    position: index + 1,
    id: item.id,
    category: item.topic,
    publishedAt: item.publishedAt,
    relative: relativeTime(item.publishedAt, now)
  })),
  diversityChangedOrder: full.diversityChangedOrder
}, null, 2));
