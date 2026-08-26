const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CalendarRank = require(path.join(root, 'calendar-rank.js'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/explore-events.json'), 'utf8'));
const events = data.events;
const now = new Date('2026-08-26T09:00:00-04:00');

function fail(message) {
  console.error('FAIL', message);
  process.exitCode = 1;
}
function pass(name) {
  console.log('PASS', name);
}
function ids(list) {
  return list.map(item => item.id);
}
function firstIds(ranked, count) {
  return ids(ranked.slice(0, count));
}

const { torontoDayKey, eventCoversDay, formatDayLabel, rankEventsForDate, emptyDayMessage } = CalendarRank;

if (formatDayLabel('2026-09-11') !== 'Sept. 11') fail(`expected Sept. 11, got ${formatDayLabel('2026-09-11')}`);
else pass('empty-copy day label uses Sept. 11');

if (torontoDayKey('2026-09-13T23:00:00-04:00') !== '2026-09-13') fail('Toronto key slipped a UTC day on Supercrawl end');
else pass('Toronto day key keeps Supercrawl on Sept. 13');

if (torontoDayKey('2026-08-28T03:01:00-04:00') !== '2026-08-28') fail('eclipse end should stay Aug. 28 in Toronto');
else pass('lunar eclipse end stays Aug. 28');

['2026-09-11', '2026-09-12', '2026-09-13'].forEach(key => {
  if (!eventCoversDay(events.find(item => item.id === 'supercrawl-2026'), key)) fail(`Supercrawl should cover ${key}`);
  else pass(`Supercrawl covers ${key}`);
});
if (eventCoversDay(events.find(item => item.id === 'supercrawl-2026'), '2026-09-10')) fail('Supercrawl should not cover Sept. 10');
else pass('Supercrawl does not cover Sept. 10');

const sept11 = rankEventsForDate(events, '2026-09-11', now);
if (sept11.onDay[0]?.id !== 'supercrawl-2026') fail('Sept. 11 should lead with Supercrawl');
else pass('Sept. 11 begins with the event that starts that day');
if (firstIds(sept11.later, 2).join() !== 'patrick-watson-rbg-2026,green-up-tree-planting-2026') fail(`later after Sept. 11: ${ids(sept11.later)}`);
else pass('later events after Sept. 11 stay chronological');

const sept12 = rankEventsForDate(events, '2026-09-12', now);
if (!sept12.onDay.some(item => item.id === 'supercrawl-2026')) fail('spanning Sept. 12 should include Supercrawl');
else pass('multi-day event stays active on the middle day');

const sept13 = rankEventsForDate(events, '2026-09-13', now);
if (sept13.onDay[0]?.id !== 'supercrawl-2026') fail('last covered day should still include Supercrawl');
else pass('multi-day event stays active on the last day');

const oneEvent = rankEventsForDate(events, '2026-08-26', now);
if (oneEvent.onDay.map(item => item.id).join() !== 'lions-market-2026-08-26') fail('Aug. 26 should have the market only');
else pass('date with one event');

const several = rankEventsForDate([
  ...events,
  { id: 'extra-a', title: 'Extra A', start: '2026-09-11T10:00:00-04:00', end: '2026-09-11T12:00:00-04:00' },
  { id: 'span-early', title: 'Started earlier', start: '2026-09-10T10:00:00-04:00', end: '2026-09-12T18:00:00-04:00' }
], '2026-09-11', now);
if (several.onDay[0].id !== 'extra-a') fail('events that begin on the selected date should rank first');
else if (!['supercrawl-2026', 'span-early'].includes(several.onDay[1].id)) fail('spanning events should follow same-day starts');
else pass('date with several events ranks starts before spans');

const firstOfMonth = rankEventsForDate(events, '2026-09-01', now);
if (firstOfMonth.onDay.length) fail('Sept. 1 should have zero listed events');
else if (emptyDayMessage('2026-09-01', firstOfMonth.later[0])[0] !== 'No events found for Sept. 1.') fail(emptyDayMessage('2026-09-01', firstOfMonth.later[0])[0]);
else if (emptyDayMessage('2026-09-01', firstOfMonth.later[0])[1] !== 'Next event: Canada’s Largest Ribfest') fail(emptyDayMessage('2026-09-01', firstOfMonth.later[0])[1]);
else if (firstOfMonth.later[0]?.id !== 'ribfest-2026') fail('next event after Sept. 1 should be Ribfest');
else pass('first of month with no events plus next-event copy');

const middleEmpty = rankEventsForDate(events, '2026-09-08', now);
if (middleEmpty.onDay.length) fail('Sept. 8 should be empty');
else if (middleEmpty.later[0]?.id !== 'supercrawl-2026') fail('next after Sept. 8 should be Supercrawl');
else pass('middle of month with no events');

const lastOfAugust = rankEventsForDate(events, '2026-08-31', now);
if (lastOfAugust.onDay.length) fail('Aug. 31 should have zero events');
else if (lastOfAugust.later[0]?.id !== 'ribfest-2026') fail('next after Aug. 31 should be Ribfest');
else pass('last day of month with no events');

const lastOfSeptember = rankEventsForDate(events, '2026-09-30', now);
if (lastOfSeptember.onDay.length || lastOfSeptember.later.length) fail('Sept. 30 should have no later listed events');
else if (emptyDayMessage('2026-09-30')[0] !== 'No events found for Sept. 30.') fail('Sept. 30 empty copy');
else pass('last day of month after the last event');

const eclipseNight = rankEventsForDate(events, '2026-08-28', now);
if (eclipseNight.onDay[0]?.id !== 'partial-lunar-eclipse-2026') fail('eclipse should still count on Aug. 28');
else pass('overnight event covers both local dates');

if (process.exitCode) {
  console.error('calendar selection tests failed');
  process.exit(process.exitCode);
} else {
  console.log('All calendar selection tests passed');
}
