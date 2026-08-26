import {
  scoreIdea,
  eligibleIdeas,
  pickNext,
  isIsolatedOutdoor,
  isNightAppropriate
} from '../lib/explore-ideas.mjs';

const ideas = {
  pier: { id: 'pier-sunset', indoorOutdoor: 'outdoor', safety: 'public', nightOk: true, tags: ['sunset', 'date'], category: 'waterfront', cost: 'free' },
  beach: { id: 'beachway-walk', indoorOutdoor: 'outdoor', safety: 'isolated', tags: ['trail', 'shoreline'], category: 'waterfront', cost: 'free' },
  trail: { id: 'kerncliff-boardwalk', indoorOutdoor: 'outdoor', safety: 'isolated', tags: ['trail'], category: 'parks', cost: 'free' },
  bagel: { id: 'jcs-bagels', indoorOutdoor: 'indoor', safety: 'indoor', tags: ['coffee', 'food'], hours: { days: ['Wed'], open: '07:00', close: '15:00' }, cost: 'paid' },
  movie: { id: 'movies-under-the-stars', indoorOutdoor: 'outdoor', safety: 'public', nightOk: true, staffedNight: true, tags: ['movie', 'event', 'night'], category: 'event', cost: 'free' },
  eclipse: { id: 'eclipse-tonight', indoorOutdoor: 'outdoor', safety: 'public', nightOk: true, tags: ['night', 'eclipse', 'event'], category: 'night', cost: 'free' },
  lookout: { id: 'cassiopeia-north-burlington', indoorOutdoor: 'outdoor', safety: 'isolated', tags: ['night', 'stargazing', 'lookout'], category: 'night', cost: 'free' }
};

function now(patch) {
  return {
    date: '2026-08-26',
    weekday: 'Wed',
    weekdayIndex: 3,
    month: 8,
    hour: 14,
    minute: 0,
    isDaylight: true,
    prefs: {},
    ...patch
  };
}

let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', message);
  }
}

assert(isIsolatedOutdoor(ideas.beach), 'beachway is isolated');
assert(!isIsolatedOutdoor(ideas.pier), 'pier is public');
assert(isNightAppropriate(ideas.movie), 'movie night is night-appropriate');
assert(!isNightAppropriate(ideas.lookout), 'isolated lookout is not night-appropriate');

const afternoon = now({ hour: 14, isDaylight: true });
assert(scoreIdea(ideas.beach, afternoon, { clear: true }) > 0, 'A: 2 p.m. clear shoreline eligible');
assert(scoreIdea(ideas.pier, afternoon, { clear: true }) > 0, 'A: pier eligible by day');

const evening = now({ hour: 20, minute: 30, isDaylight: false });
assert(scoreIdea(ideas.beach, evening) === 0, 'B: 8:30 p.m. isolated shoreline excluded');
assert(scoreIdea(ideas.trail, evening) === 0, 'B: isolated trail excluded after dark');
assert(scoreIdea(ideas.pier, evening) > 0, 'B: public pier can remain');

const late = now({ hour: 22, minute: 30, isDaylight: false });
const latePool = eligibleIdeas(Object.values(ideas), late);
assert(latePool.every(idea => idea.id !== 'beachway-walk' && idea.id !== 'kerncliff-boardwalk'), 'C: isolated outdoor gone late');
assert(latePool.some(idea => idea.id === 'jcs-bagels' || idea.id === 'movies-under-the-stars' || idea.id === 'eclipse-tonight'), 'C: staffed/night ideas remain');

assert(scoreIdea(ideas.movie, now({ hour: 20, isDaylight: false })) > 0, 'D: Friday public movie night eligible');

assert(scoreIdea(ideas.beach, afternoon, { thunderstorm: true }) === 0, 'E: storm removes exposed outdoor');
assert(scoreIdea(ideas.bagel, afternoon, { thunderstorm: true }) > 0, 'E: indoor remains in storm');

assert(scoreIdea(ideas.eclipse, now({ hour: 22, isDaylight: false })) > 0, 'F: organized eclipse eligible');
assert(scoreIdea(ideas.lookout, now({ hour: 21, isDaylight: false })) === 0, 'G: secluded waterfront/lookout after dark rejected');

const closed = scoreIdea(ideas.bagel, now({ hour: 20, weekday: 'Wed' }));
assert(closed === 0, 'closed business with hours is not recommended');

const seen = [];
const first = pickNext(Object.values(ideas), afternoon, { clear: true }, seen, '', () => 0);
const second = pickNext(Object.values(ideas), afternoon, { clear: true }, [first.id], first.id, () => 0.99);
assert(first && second && first.id !== second.id, 'session avoids immediate repeat when others exist');

const market = {
  id: 'farmers-market',
  indoorOutdoor: 'outdoor',
  safety: 'public',
  nightOk: true,
  tags: ['market', 'event'],
  hours: {
    days: ['Wed', 'Fri', 'Sat'],
    open: '07:00',
    close: '14:30',
    soonMinutes: 90,
    seasonStart: '2026-05-20',
    seasonEnd: '2026-10-24',
    evening: {
      days: ['Wed'],
      seasonStart: '2026-06-03',
      seasonEnd: '2026-09-30',
      open: '14:30',
      close: '19:30'
    }
  }
};
assert(scoreIdea(market, now({ hour: 17, minute: 30, isDaylight: false })) > 0, 'Wed 5:30 p.m. evening market eligible');
assert(scoreIdea(market, now({ hour: 21, isDaylight: false })) === 0, 'Wed 9 p.m. market ended');
assert(scoreIdea(market, now({ hour: 15, weekday: 'Fri', weekdayIndex: 5 })) === 0, 'Fri 3 p.m. regular market ended');
assert(scoreIdea(market, now({ date: '2026-10-25', hour: 10 })) === 0, 'after Oct 24 2026 no market');

if (failed) process.exit(1);
console.log('PASS after-dark and weather ranking');
