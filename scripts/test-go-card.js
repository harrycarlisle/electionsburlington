import assert from 'node:assert/strict';
import { buildGoModel, isUpcomingJourney, upcomingJourneys, formatClock } from '../lib/go-times.js';

function atToronto(isoLocal) {
  return new Date(`${isoLocal}-04:00`);
}

const morningPast = {
  generatedAt: '2026-08-26T07:00:00-04:00',
  dataKind: 'scheduled',
  routes: [
    {
      origin: { label: 'Burlington', stopCode: 'BU' },
      destination: { label: 'Union', stopCode: 'UN' },
      journeys: [
        { departure: '07:10:00', scheduled: true },
        { departure: '07:22:00', scheduled: true },
        { departure: '07:52:00', scheduled: true },
        { departure: '08:06:00', scheduled: true }
      ]
    },
    {
      origin: { label: 'Union', stopCode: 'UN' },
      destination: { label: 'Burlington', stopCode: 'BU' },
      journeys: [
        { departure: '07:17:00', scheduled: true },
        { departure: '17:05:00', scheduled: true }
      ]
    }
  ]
};

function assertNoPast(model, nowMin) {
  if (!model.time) return;
  const match = model.time.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)/);
  assert.ok(match, `expected a clock, got ${model.time}`);
  let hour = Number(match[1]) % 12;
  if (match[3] === 'p.m.') hour += 12;
  if (match[3] === 'a.m.' && match[1] === '12') hour = 0;
  const minutes = hour * 60 + Number(match[2]);
  assert.ok(minutes > nowMin, `past departure shown: ${model.time} at ${nowMin}`);
}

const cases = [
  { label: '7:48 a.m.', now: atToronto('2026-08-26T07:48:00'), expectTime: '7:52 a.m.', expectStatus: 'Scheduled', nowMin: 7 * 60 + 48 },
  { label: '8:05 a.m.', now: atToronto('2026-08-26T08:05:00'), expectTime: '8:06 a.m.', expectStatus: 'Scheduled', nowMin: 8 * 60 + 5 },
  { label: '12:00 p.m.', now: atToronto('2026-08-26T12:00:00'), expectUnavailable: true, nowMin: 12 * 60 },
  { label: '5:30 p.m.', now: atToronto('2026-08-26T17:30:00'), expectUnavailable: true, inbound: true, nowMin: 17 * 60 + 30 },
  { label: '11:30 p.m.', now: atToronto('2026-08-26T23:30:00'), expectUnavailable: true, nowMin: 23 * 60 + 30 }
];

for (const item of cases) {
  const model = buildGoModel(morningPast, item.now);
  assert.equal(model.time.includes('7:10'), false, `${item.label} showed 7:10`);
  assert.equal(model.time.includes('7:22'), false, `${item.label} showed 7:22`);
  assertNoPast(model, item.nowMin);
  if (item.expectUnavailable) {
    assert.equal(model.unavailable, true, `${item.label} should be unavailable`);
    assert.equal(model.time, '', `${item.label} should hide a past clock`);
    assert.equal(model.detail, 'Schedule unavailable');
    assert.equal(model.status, '');
  } else {
    assert.equal(model.time, item.expectTime, `${item.label} time`);
    assert.equal(model.status, item.expectStatus, `${item.label} status`);
    assert.equal(model.headline, 'Burlington → Union');
  }
}

const live = {
  generatedAt: '2026-08-26T07:47:00-04:00',
  dataKind: 'live',
  routes: [{
    origin: { label: 'Burlington', stopCode: 'BU' },
    destination: { label: 'Union', stopCode: 'UN' },
    journeys: [
      { departure: '07:52:00', computedDeparture: '07:52:00', departureStatus: 'On time' },
      { departure: '08:06:00', computedDeparture: '08:18:00', departureStatus: 'Delayed' }
    ]
  }]
};
const liveModel = buildGoModel(live, atToronto('2026-08-26T07:48:00'));
assert.equal(liveModel.time, '7:52 a.m.');
assert.equal(liveModel.status, 'On time');
assert.equal(liveModel.scheduled, false);

const delayed = {
  generatedAt: '2026-08-26T07:47:00-04:00',
  dataKind: 'live',
  routes: [{
    origin: { label: 'Burlington', stopCode: 'BU' },
    destination: { label: 'Union', stopCode: 'UN' },
    journeys: [
      { departure: '07:40:00', computedDeparture: '07:46:00', departureStatus: 'Delayed' },
      { departure: '08:06:00', computedDeparture: '08:18:00', departureStatus: 'Delayed' }
    ]
  }]
};
const delayedStill = buildGoModel(delayed, atToronto('2026-08-26T07:48:00'));
assert.equal(delayedStill.time, '7:46 a.m.', 'realtime grace should keep a just-delayed train');
assert.equal(delayedStill.status, '+6 min');

const delayedGone = buildGoModel(delayed, atToronto('2026-08-26T07:55:00'));
assert.equal(delayedGone.time, '8:18 a.m.');
assert.equal(delayedGone.status, '+12 min');

const staleLive = {
  ...live,
  generatedAt: '2026-08-26T06:00:00-04:00'
};
const staleModel = buildGoModel(staleLive, atToronto('2026-08-26T07:48:00'));
assert.equal(staleModel.scheduled, true);
assert.equal(staleModel.status, 'Scheduled');
assert.equal(staleModel.dataKind, 'stale');

const inboundEvening = {
  generatedAt: '2026-08-26T17:00:00-04:00',
  dataKind: 'scheduled',
  routes: [
    {
      origin: { label: 'Burlington', stopCode: 'BU' },
      destination: { label: 'Union', stopCode: 'UN' },
      journeys: [{ departure: '18:10:00', scheduled: true }]
    },
    {
      origin: { label: 'Union', stopCode: 'UN' },
      destination: { label: 'Burlington', stopCode: 'BU' },
      journeys: [{ departure: '17:42:00', scheduled: true }]
    }
  ]
};
const evening = buildGoModel(inboundEvening, atToronto('2026-08-26T17:30:00'));
assert.equal(evening.headline, 'Union → Burlington');
assert.equal(evening.time, '5:42 p.m.');
assert.equal(evening.status, 'Scheduled');

const nextDay = {
  generatedAt: '2026-08-26T23:00:00-04:00',
  dataKind: 'scheduled',
  routes: [{
    origin: { label: 'Burlington', stopCode: 'BU' },
    destination: { label: 'Union', stopCode: 'UN' },
    journeys: [{ departure: '00:15:00', scheduled: true, nextServiceDay: true }]
  }]
};
const late = buildGoModel(nextDay, atToronto('2026-08-26T23:30:00'));
assert.equal(late.time, '12:15 a.m.');
assert.equal(isUpcomingJourney({ departure: '07:22:00' }, 7 * 60 + 48), false);
assert.equal(upcomingJourneys({ journeys: [{ departure: '07:22:00' }, { departure: '07:52:00' }] }, 7 * 60 + 48).length, 1);
assert.equal(formatClock('07:52:00'), '7:52 a.m.');

console.log('go-card tests passed');
