import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cameraIsValid,
  cameraConflictsRoute,
  cameraTrafficState,
  clipPolyline,
  incidentFeatureLabel,
  incidentMatchesRoute,
  incidentOnRouteMap,
  incidentRelevance,
  routeDriveStatus,
  selectRouteCameras,
  ROUTE_START
} from '../lib/traffic-route.js';

const cameras = JSON.parse(readFileSync(new URL('../data/traffic-cameras.json', import.meta.url), 'utf8')).cameras;
const routes = JSON.parse(readFileSync(new URL('../data/traffic-routes.json', import.meta.url), 'utf8'));
const surface = JSON.parse(readFileSync(new URL('../data/traffic-surface.json', import.meta.url), 'utf8'));

const fortErie = cameras.find(item => /fort erie/i.test(`${item.cameraName} ${item.viewName} ${item.direction}`));
assert.ok(fortErie, 'expected a Fort Erie camera in inventory');
assert.equal(cameraConflictsRoute(fortErie, 'toronto'), true);
assert.equal(cameraIsValid(fortErie, 'toronto'), false);

const clipped = clipPolyline(routes.routes.toronto.polyline, ROUTE_START.toronto);
const toronto = selectRouteCameras('toronto', surface.routes.toronto.cameras, cameras, clipped.line, {
  start: ROUTE_START.toronto,
  fullLine: routes.routes.toronto.polyline,
  startIndex: clipped.startIndex
});
assert.ok(toronto.length >= 3 && toronto.length <= 6, `expected 3-6 Toronto cameras, got ${toronto.length}`);
assert.equal(toronto.some(item => /fort erie/i.test(`${item.cameraName} ${item.viewName} ${item.direction}`)), false);
assert.ok(/guelph|walkers|appleby/i.test(`${toronto[0].cameraName} ${toronto[0].nearestRoad}`), `first camera should be east of Brant, got ${toronto[0].cameraName}`);
assert.equal(/brant/i.test(toronto[0].cameraName), false, 'Toronto should not start west of Guelph Line');
assert.ok(toronto.at(-1).longitude > toronto[0].longitude, 'Toronto sequence should move east');

const incident = { title: 'QEW Fort Erie-bound off-ramp closed', direction: 'Fort Erie-bound' };
assert.equal(incidentMatchesRoute(incident, 'toronto'), false);
assert.equal(incidentMatchesRoute({ title: 'QEW Toronto-bound on-ramp closed at Dorval Drive', direction: 'Toronto-bound' }, 'toronto'), true);

const dorval = {
  title: 'QEW Toronto-bound on-ramp closed at Dorval Drive',
  rawHeadline: 'Continuous Construction on QEW Toronto bound On-ramp at DORVAL DRIVE, Oakville. ALL LANES CLOSED.',
  direction: 'Toronto-bound',
  type: 'closure',
  facility: 'on-ramp',
  nearestRoad: 'Dorval Drive'
};
assert.equal(incidentRelevance(dorval, 'toronto'), 'local');
assert.equal(incidentOnRouteMap(dorval, 'toronto'), true);
assert.equal(incidentRelevance(dorval, 'niagara-falls'), 'opposite');
assert.equal(incidentOnRouteMap({ ...incident, facility: 'off-ramp', type: 'closure', nearestRoad: 'Christie St' }, 'toronto'), false);

const torontoStatus = routeDriveStatus([dorval], 'toronto');
assert.equal(torontoStatus.headline, 'Moving well');
assert.equal(torontoStatus.level, 'clear');
assert.match(torontoStatus.secondary, /Toronto-bound on-ramp closed at Dorval Drive/);
assert.equal(torontoStatus.impact, 'Local access affected');
assert.doesNotMatch(torontoStatus.headline, /ramp closed|delay likely/i);

const christie = {
  title: 'QEW Fort Erie-bound off-ramp closed at Christie St / Lakeview Ave',
  direction: 'Fort Erie-bound',
  type: 'closure',
  facility: 'off-ramp',
  nearestRoad: 'Christie St / Lakeview Ave'
};
const niagaraStatus = routeDriveStatus([christie], 'niagara-falls');
assert.equal(niagaraStatus.headline, 'Moving well');
assert.match(niagaraStatus.secondary, /Fort Erie-bound off-ramp closed/);
assert.equal(niagaraStatus.impact, 'Local access affected');
assert.equal(routeDriveStatus([christie], 'toronto').headline, 'Moving well');
assert.equal(routeDriveStatus([christie], 'toronto').secondary, '');

const skyway = {
  title: 'Collision on QEW near Burlington Skyway',
  direction: 'Toronto-bound',
  type: 'collision',
  facility: 'mainline',
  nearestRoad: 'Burlington Skyway'
};
const collisionStatus = routeDriveStatus([skyway], 'toronto');
assert.match(collisionStatus.headline, /Some slowing|Heavy/);
assert.equal(collisionStatus.impact, 'Likely affecting traffic');
assert.match(incidentFeatureLabel(skyway), /Collision/);

const oppositeNeverPrimary = routeDriveStatus([christie, dorval], 'toronto');
assert.equal(oppositeNeverPrimary.headline, 'Moving well');
assert.doesNotMatch(oppositeNeverPrimary.secondary, /Fort Erie/);

const delayed = routeDriveStatus([{ ...skyway, delayMinutes: 12 }], 'toronto');
assert.match(delayed.headline, /Heavy near Burlington Skyway/);
assert.equal(delayed.minutes, 12);

assert.equal(cameraTrafficState({}, {}).label, '');
assert.equal(cameraTrafficState({}, {}).puck, 'unknown');
assert.equal(cameraTrafficState({}, { officialState: 'heavy' }).label, 'Heavy traffic');
assert.equal(cameraTrafficState({}, { unavailable: true }).puck, 'unavailable');

assert.ok(clipped.line.length < routes.routes.toronto.polyline.length, 'Toronto polyline should drop the downtown wander');
assert.ok(Math.abs(clipped.line[0][0] - ROUTE_START.toronto.lat) < 0.02);

function camerasFor(routeId) {
  const raw = routes.routes[routeId];
  const cut = clipPolyline(raw.polyline, ROUTE_START[routeId]);
  return selectRouteCameras(routeId, surface.routes[routeId]?.cameras || [], cameras, cut.line, {
    start: ROUTE_START[routeId],
    fullLine: raw.polyline,
    startIndex: cut.startIndex || 0
  });
}

const hamilton = camerasFor('hamilton');
const niagara = camerasFor('niagara-falls');
assert.ok(hamilton.length >= 2 && hamilton.length <= 6, `expected Hamilton cameras, got ${hamilton.length}`);
assert.ok(niagara.length >= 3 && niagara.length <= 6, `expected Niagara cameras, got ${niagara.length}`);
assert.ok(hamilton.every((item, index, list) => !index || item.progress >= list[index - 1].progress), 'Hamilton cameras must follow route progress');
assert.ok(niagara.every((item, index, list) => !index || item.progress >= list[index - 1].progress), 'Niagara cameras must follow route progress');
assert.equal(hamilton[0].puck, 1);
assert.equal(niagara[0].puck, 1);
assert.equal(hamilton.some(item => /brant/i.test(item.cameraName || '')), false, 'Hamilton should not bounce back to Brant Street');
assert.ok(hamilton.some(item => /skyway/i.test(item.cameraName || '')), 'Hamilton should include the Skyway');
assert.ok(hamilton.at(-1).latitude < hamilton[0].latitude, 'Hamilton sequence should move toward Hamilton');
assert.ok(/skyway|northshore|eastport/i.test(`${niagara[0].cameraName} ${niagara[1].cameraName}`), `Niagara should start on the Burlington approach, got ${niagara[0].cameraName}`);

console.log('traffic-route tests passed');
console.log('Toronto:\n' + toronto.map(item => `${item.puck}. ${item.cameraName}`).join('\n'));
console.log('Hamilton:\n' + hamilton.map(item => `${item.puck}. ${item.cameraName}`).join('\n'));
console.log('Niagara:\n' + niagara.map(item => `${item.puck}. ${item.cameraName}`).join('\n'));
