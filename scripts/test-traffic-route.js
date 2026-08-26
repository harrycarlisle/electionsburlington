import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cameraIsValid,
  cameraConflictsRoute,
  clipPolyline,
  incidentMatchesRoute,
  selectRouteCameras,
  BURLINGTON_ROUTE_ORIGIN,
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
assert.ok(toronto.length >= 3 && toronto.length <= 8, `expected 3-8 Toronto cameras, got ${toronto.length}`);
assert.equal(toronto.some(item => /fort erie/i.test(`${item.cameraName} ${item.viewName} ${item.direction}`)), false);
assert.ok(/guelph|walkers|appleby/i.test(`${toronto[0].cameraName} ${toronto[0].nearestRoad}`), `first camera should be east of Brant, got ${toronto[0].cameraName}`);
assert.equal(/brant/i.test(toronto[0].cameraName), false, 'Toronto should not start west of Guelph Line');
assert.ok(toronto.at(-1).longitude > toronto[0].longitude, 'Toronto sequence should move east');
assert.ok(toronto.at(-1).longitude > -79.70, `Toronto coverage should continue east of Oakville, last was ${toronto.at(-1).cameraName}`);
['toronto', 'oakville', 'hamilton', 'stoney-creek', 'niagara-falls'].forEach(id => {
  assert.equal(ROUTE_START[id].lat, BURLINGTON_ROUTE_ORIGIN.lat);
  assert.equal(ROUTE_START[id].lon, BURLINGTON_ROUTE_ORIGIN.lon);
});

const incident = { title: 'QEW Fort Erie-bound off-ramp closed', direction: 'Fort Erie-bound' };
assert.equal(incidentMatchesRoute(incident, 'toronto'), false);
assert.equal(incidentMatchesRoute({ title: 'QEW Toronto-bound on-ramp closed at Dorval Drive', direction: 'Toronto-bound' }, 'toronto'), true);

assert.ok(Math.abs(clipped.line[0][0] - ROUTE_START.toronto.lat) < 0.02);
assert.ok(Math.abs(clipped.line[0][1] - ROUTE_START.toronto.lon) < 0.02);
['toronto', 'oakville', 'hamilton', 'stoney-creek', 'niagara-falls'].forEach(id => {
  const start = routes.routes[id].polyline[0];
  const distLat = Math.abs(start[0] - BURLINGTON_ROUTE_ORIGIN.lat);
  const distLon = Math.abs(start[1] - BURLINGTON_ROUTE_ORIGIN.lon);
  assert.ok(distLat < 0.01 && distLon < 0.01, `${id} should start at Guelph Line, got ${start}`);
});

console.log('traffic-route tests passed');
console.log(toronto.map(item => `${item.puck}. ${item.cameraName}`).join('\n'));
