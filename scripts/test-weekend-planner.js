import { readFileSync } from 'node:fs';

let failed = 0;
const fail = message => {
  console.error('FAIL', message);
  failed += 1;
};
const read = path => readFileSync(path, 'utf8');

const food = JSON.parse(read('data/explore-food.json'));
if (food.spots.length < 5) fail('weekend planner needs at least five verified food stops');
food.spots.forEach(spot => {
  for (const field of ['title', 'address', 'dish', 'image', 'url']) {
    if (!spot[field]) fail(`${spot.id || 'food stop'} is missing ${field}`);
  }
  if (!Array.isArray(spot.roles) || !spot.roles.length) fail(`${spot.id} is missing a route role`);
});

const explore = read('explore/index.html');
if (!explore.includes('<h1>Explore Burlington</h1>')) fail('Explore landing page was not restored');
if (!explore.includes('id="eventGrid"') || !explore.includes('id="boredCard"') || !explore.includes('id="passportRail"')) {
  fail('Explore landing page is missing the event-first layout');
}
if (!explore.includes('href="/explore/weekend/"')) fail('Explore landing page does not offer the weekend view');
if (explore.includes('/weekend-planner.js')) fail('the optional planner still replaces the Explore landing page');

const weekend = read('explore/weekend/index.html');
if (!weekend.includes('/weekend-planner.js')) fail('weekend page does not load the planner');
if (!weekend.includes('id="weekendEvents"')) fail('weekend page has no complete event-list host');
if (!weekend.includes('id="plannerToggle"')) fail('weekend page has no planner choice');
if (!weekend.includes('id="plannerPanel" class="planner-panel" hidden')) fail('planner is not optional by default');
if (!weekend.includes('id="planRoute"') || !weekend.includes('id="eat"')) fail('optional planner has no visual route and food destination');
if (/direct answer|authority-copy|verified meals, not/i.test(weekend)) fail('weekend page still contains the old text-heavy authority copy');

const foodRedirect = read('food/index.html');
if (!foodRedirect.includes("/explore/weekend/?plan=1#eat")) fail('/food/ does not open the optional integrated plan');
if (!/noindex/i.test(foodRedirect)) fail('/food/ redirect should not compete in search');

const publicUrlSync = read('scripts/sync_public_urls.py');
if (publicUrlSync.includes('(ROOT / "explore.html", ROOT / "explore" / "index.html")')) {
  fail('hourly URL sync would overwrite the visual Explore planner');
}
const indexing = read('scripts/search_indexing_hygiene.py');
if (/^\s*"\/food\/",/m.test(indexing)) fail('/food/ redirect would be re-added to the sitemap');

const planner = read('weekend-planner.js');
if (!planner.includes("America/Toronto")) fail('planner date logic is not pinned to Burlington time');
if (!planner.includes('event.end') || !planner.includes('Date.now()')) fail('planner does not remove events once they finish');
if (!planner.includes('mapsUrl')) fail('planner is missing its route link');
if (!planner.includes('renderWeekendEvents(events, days, today)')) fail('weekend events are not rendered before the planner');
if (!planner.includes("setPlannerOpen(params.get('plan') === '1'")) fail('optional planner state does not follow the URL');
if (!planner.includes('openEventModal(requestedRow, { updateUrl: false })')) fail('event deep links do not open the requested detail card');
if (!planner.includes('mapsSearchUrl(address)')) fail('event addresses do not link to Google Maps');
if (!planner.includes('role="dialog"') || !planner.includes('aria-modal="true"')) fail('event details are not an accessible dialog');

const liveUtility = read('local-now.js');
if (!liveUtility.includes("item.id ? `/explore/?event=${encodeURIComponent(item.id)}`")) {
  fail('the live event card does not prioritize the Explore event deep link');
}

const css = read('weekend-planner.css');
if (!css.includes('.plan-route') || !css.includes('.visual-grid')) fail('planner visual layout is missing');
if (!css.includes('data-theme="dark"')) fail('planner dark mode is missing');
if (!css.includes('.event-dialog-address') || !css.includes('.event-modal')) fail('event dialog styling is missing');

if (failed) process.exit(1);
console.log('PASS weekend planner', food.spots.length, 'food stops');
