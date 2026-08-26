import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cameraIsValid,
  cameraConflictsRoute,
  clipPolyline,
  incidentMatchesRoute,
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
const allowed = new Set([598, 599, 583, 603, 605]);
for (const cam of toronto) {
  assert.equal(allowed.has(Number(cam.viewId)), true, `unexpected Toronto camera ${cam.viewId} ${cam.cameraName}`);
}
assert.ok(/third|trafalgar|windsor|ford/i.test(`${toronto[0].cameraName} ${toronto[0].nearestRoad}`), `first verified Toronto-bound camera, got ${toronto[0].cameraName}`);
assert.ok(toronto.at(-1).longitude > toronto[0].longitude, 'Toronto sequence should move east');

const incident = { title: 'QEW Fort Erie-bound off-ramp closed', direction: 'Fort Erie-bound' };
assert.equal(incidentMatchesRoute(incident, 'toronto'), false);
assert.equal(incidentMatchesRoute({ title: 'QEW Toronto-bound on-ramp closed at Dorval Drive', direction: 'Toronto-bound' }, 'toronto'), true);

assert.ok(clipped.line.length < routes.routes.toronto.polyline.length, 'Toronto polyline should drop the downtown wander');
assert.ok(Math.abs(clipped.line[0][0] - ROUTE_START.toronto.lat) < 0.02);

console.log('traffic-route tests passed');
console.log(toronto.map(item => `${item.puck}. ${item.cameraName}`).join('\n'));
