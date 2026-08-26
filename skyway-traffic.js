import {
  ROUTE_START,
  clipPolyline,
  incidentMatchesRoute,
  selectRouteCameras,
  shortCameraPlace,
  delayFromIncident
} from '/lib/traffic-route.js';

const DESTINATIONS = [
  {id:'toronto', label:'Toronto'},
  {id:'oakville', label:'Oakville'},
  {id:'hamilton', label:'Hamilton'},
  {id:'stoney-creek', label:'Stoney Creek'},
  {id:'niagara-falls', label:'Niagara'}
];
const ROTATE_MS = 6000;
const SWIPE_PX = 36;
const SKYWAY_VIEWS = {
  toronto: 12,
  oakville: 12,
  hamilton: 10,
  'stoney-creek': 10,
  'niagara-falls': 10
};

const live = new Set();
let cameras = [];
let surface = null;
let routesData = null;
let estimates = {};
let selectedIndex = 0;
let routeCameras = [];
let map = null;
let routeLine = null;
let puckLayer = null;
let incidentLayer = null;
let userTouched = false;
let rotateTimer = 0;
let popup = null;

function routeFromLocation() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('route') || params.get('destination') || '';
  if (DESTINATIONS.some(item => item.id === requested)) return requested;
  if (params.get('focus') === 'skyway') return 'hamilton';
  return 'toronto';
}

let mode = routeFromLocation();
const wantsSkyway = new URLSearchParams(location.search).get('focus') === 'skyway';

const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId = id => document.getElementById(id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark = () => document.documentElement.dataset.theme === 'dark';

function tileUrl() {
  return isDark()
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

function selectedRoute() {
  return surface?.routes?.[mode] || null;
}

function polylineFor(routeId) {
  const raw = routesData?.routes?.[routeId]?.polyline || [];
  return clipPolyline(raw, ROUTE_START[routeId]);
}

function lineCoords(routeId) {
  return polylineFor(routeId).line || [];
}

function originLabel(routeId) {
  return ROUTE_START[routeId]?.label || 'Burlington QEW';
}

function destinationLabel() {
  return DESTINATIONS.find(item => item.id === mode)?.label || selectedRoute()?.destination || 'Toronto';
}

function looksFor(cam) {
  const key = String(cam.viewId || cam.cameraId);
  return estimates[key]?.traffic || cam.looks || '';
}

function clockLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12'
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  const dayPeriod = (parts.find(part => part.type === 'dayPeriod')?.value || '').replace('a.m.', 'a.m.').replace('p.m.', 'p.m.');
  return minute === '00' ? `${hour} ${dayPeriod}` : `${hour}:${minute} ${dayPeriod}`;
}

function camerasForMode() {
  const route = selectedRoute();
  const clipped = polylineFor(mode);
  const line = clipped.line || [];
  const picked = selectRouteCameras(mode, route?.cameras || [], cameras, line, {
    start: ROUTE_START[mode],
    fullLine: routesData?.routes?.[mode]?.polyline || line,
    startIndex: clipped.startIndex || 0
  });
  if (!wantsSkyway) return picked;
  const skyId = SKYWAY_VIEWS[mode];
  const sky = cameras.find(item => Number(item.viewId) === skyId);
  if (!sky || picked.some(item => Number(item.viewId) === skyId)) return picked;
  return [{ ...sky, puck: 1, sourceUrl: sky.sourceUrl }, ...picked.map((item, index) => ({ ...item, puck: index + 2 }))].slice(0, 6);
}

function routeIncidents() {
  const route = selectedRoute();
  return (route?.incidents || []).filter(item => {
    if (!Number.isFinite(Number(item.latitude)) || !Number.isFinite(Number(item.longitude))) return false;
    return incidentMatchesRoute(item, mode);
  });
}

function noteInteraction() {
  userTouched = true;
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = 0;
  }
}

function writeUrl() {
  const next = new URL(location.href);
  next.searchParams.set('destination', mode);
  next.searchParams.delete('route');
  if (wantsSkyway) next.searchParams.set('focus', 'skyway');
  history.replaceState(null, '', next);
}

function renderChips() {
  const host = byId('routeChips');
  if (!host) return;
  host.innerHTML = DESTINATIONS.map(item => `<button type="button" data-route="${item.id}"${item.id === mode ? ' aria-pressed="true"' : ''}>${esc(item.label)}</button>`).join('');
  host.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      mode = button.dataset.route;
      selectedIndex = 0;
      writeUrl();
      renderAll();
    });
  });
}

function statusCopy() {
  const incidents = routeIncidents();
  const closure = incidents.find(item => item.type === 'closure' || item.type === 'collision');
  const minutes = delayFromIncident(closure) || delayFromIncident(selectedRoute()?.status);
  const looks = String(selectedRoute()?.status?.looks || '').toLowerCase();
  let headline = 'Live cameras';
  if (closure) headline = /ramp/i.test(`${closure.facility || ''} ${closure.title || ''}`) ? 'Ramp closed' : 'Delay likely';
  else if (looks === 'heavy') headline = 'Heavy traffic';
  else if (looks === 'moderate' || looks === 'slow') headline = 'Moderate traffic';
  else if (looks === 'light' || looks === 'clear') headline = 'Moving well';
  const detail = closure
    ? (/ramp/i.test(`${closure.facility || ''} ${closure.title || ''}`)
      ? `Ramp closure near ${closure.nearestRoad || 'this route'}`
      : closure.title)
    : (selectedRoute()?.status?.detail && !/no current camera estimate/i.test(selectedRoute().status.detail) ? selectedRoute().status.detail : '');
  return { headline, minutes, detail };
}

function renderStatus() {
  const status = byId('routeStatus');
  const origin = byId('routeOrigin');
  const copy = statusCopy();
  if (origin) origin.textContent = `From ${originLabel(mode)}.`;
  if (!status) return;
  status.innerHTML = `
    <p class="route-kicker">Burlington → ${esc(destinationLabel())}</p>
    <div class="route-status-row">
      <h2>${esc(copy.headline)}</h2>
      ${copy.minutes ? `<b>+${copy.minutes} min</b>` : ''}
    </div>
    ${copy.detail ? `<p>${esc(copy.detail)}</p>` : '<p>No major incidents on this route right now.</p>'}`;
}

function puckIcon(number, selected) {
  return window.L.divIcon({
    className: `route-puck${selected ? ' is-selected' : ''}`,
    html: `<span>${number}</span>`,
    iconSize: selected ? [34, 34] : [26, 26],
    iconAnchor: selected ? [17, 17] : [13, 13]
  });
}

function incidentIcon() {
  return window.L.divIcon({
    className: 'route-incident',
    html: '<span>!</span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function ensureMap(line) {
  const host = byId('routeMap');
  if (!host || !window.L) return;
  if (!map) {
    map = window.L.map(host, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false
    });
    window.L.control.zoom({ position: 'topright' }).addTo(map);
    window.L.tileLayer(tileUrl(), { maxZoom: 18 }).addTo(map);
    puckLayer = window.L.layerGroup().addTo(map);
    incidentLayer = window.L.layerGroup().addTo(map);
  }
  if (routeLine) map.removeLayer(routeLine);
  routeLine = window.L.polyline(line, {
    color: isDark() ? '#8ec4ea' : '#1d4f78',
    weight: 5,
    opacity: 0.88
  }).addTo(map);
  if (line.length) map.fitBounds(routeLine.getBounds(), { padding: [28, 28], maxZoom: 12 });
}

function renderMarkers() {
  if (!puckLayer || !incidentLayer) return;
  puckLayer.clearLayers();
  incidentLayer.clearLayers();
  routeCameras.forEach((cam, index) => {
    const marker = window.L.marker([cam.latitude, cam.longitude], {
      icon: puckIcon(cam.puck || index + 1, index === selectedIndex),
      keyboard: true,
      title: `Camera ${cam.puck || index + 1}`
    });
    marker.on('click', () => {
      noteInteraction();
      selectCamera(index);
    });
    puckLayer.addLayer(marker);
  });
  routeIncidents().forEach(item => {
    const marker = window.L.marker([item.latitude, item.longitude], { icon: incidentIcon(), title: item.nearestRoad || item.title });
    marker.on('click', () => {
      noteInteraction();
      if (popup) popup.remove();
      popup = window.L.popup({ className: 'route-incident-popup', closeButton: true })
        .setLatLng([item.latitude, item.longitude])
        .setContent(`<strong>${esc(item.nearestRoad ? `⚠ ${item.nearestRoad}` : 'Incident')}</strong><p>${esc(item.title)}</p>`)
        .openOn(map);
    });
    incidentLayer.addLayer(marker);
  });
}

function cameraCaption(cam) {
  const road = cam.roadway || 'QEW';
  const place = shortCameraPlace(cam);
  const dir = cam.direction || cam.viewName || '';
  return [road, dir, place && `at ${place}`].filter(Boolean).join(' ');
}

function renderPreview() {
  const host = byId('cameraPreview');
  const cam = routeCameras[selectedIndex];
  if (!host) return;
  if (!cam) {
    host.innerHTML = '<p class="camera-empty">No verified cameras on this route.</p>';
    return;
  }
  const updated = clockLabel(surface?.generatedAt);
  const looks = looksFor(cam);
  host.innerHTML = `
    <div class="camera-preview-head">
      <p>Camera ${cam.puck || selectedIndex + 1} · ${esc(shortCameraPlace(cam))}</p>
      <span class="live-chip"><i aria-hidden="true"></i> LIVE</span>
    </div>
    <div class="camera-preview-shot" data-camera-swipe>
      <button type="button" class="camera-nav is-prev" data-camera-step="-1" aria-label="Previous camera">‹</button>
      <figure>
        <img crossorigin="anonymous" data-camera="${esc(cam.viewId)}" src="https://511on.ca/map/Cctv/${esc(cam.viewId)}" alt="Live Ontario 511 camera: ${esc(cam.cameraName)}">
      </figure>
      <button type="button" class="camera-nav is-next" data-camera-step="1" aria-label="Next camera">›</button>
    </div>
    <p class="camera-preview-meta">${esc(cameraCaption(cam))}${updated ? ` · Updated ${esc(updated)}` : ''}${looks ? ` · Traffic looks ${esc(looks)}` : ''}</p>
    <div class="camera-pucks" role="tablist" aria-label="Cameras along this route">
      ${routeCameras.map((item, index) => `<button type="button" role="tab" aria-selected="${index === selectedIndex}" data-camera-index="${index}">${item.puck || index + 1}</button>`).join('')}
    </div>`;
  bindPreview(host);
  bindImage(host.querySelector('[data-camera]'));
}

function selectCamera(index, fromUser = true) {
  if (!routeCameras.length) return;
  selectedIndex = (index + routeCameras.length) % routeCameras.length;
  if (fromUser) noteInteraction();
  renderMarkers();
  renderPreview();
  paintStatus();
}

function bindPreview(host) {
  host.querySelectorAll('[data-camera-step]').forEach(button => {
    button.addEventListener('click', () => selectCamera(selectedIndex + Number(button.dataset.cameraStep)));
  });
  host.querySelectorAll('[data-camera-index]').forEach(button => {
    button.addEventListener('click', () => selectCamera(Number(button.dataset.cameraIndex)));
  });
  const shot = host.querySelector('[data-camera-swipe]');
  if (!shot) return;
  let startX = 0;
  let startY = 0;
  let swiping = false;
  shot.addEventListener('touchstart', event => {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    swiping = false;
  }, {passive:true});
  shot.addEventListener('touchmove', event => {
    const dx = event.touches[0].clientX - startX;
    const dy = event.touches[0].clientY - startY;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping = true;
  }, {passive:true});
  shot.addEventListener('touchend', event => {
    const dx = event.changedTouches[0].clientX - startX;
    if (swiping && Math.abs(dx) >= SWIPE_PX) selectCamera(selectedIndex + (dx < 0 ? 1 : -1));
  });
}

function looksUnavailable(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    let yellow = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] > 180 && data[i + 1] > 150 && data[i + 2] < 90) yellow++;
    }
    return yellow > 10;
  } catch (_) {
    return false;
  }
}

function paintStatus() {
  const el = byId('cameraStatus');
  const images = [...document.querySelectorAll('#cameraPreview [data-camera]')];
  const count = images.filter(image => live.has(image.dataset.camera) && image.naturalWidth).length;
  if (el) el.textContent = routeCameras.length ? `${count ? 'Live' : 'Loading'} · ${routeCameras.length} cameras` : 'Loading cameras';
}

function bindImage(image) {
  if (!image || image.dataset.bound) return;
  image.dataset.bound = '1';
  const fail = () => {
    live.delete(image.dataset.camera);
    paintStatus();
  };
  image.addEventListener('load', () => {
    if (!image.naturalWidth || looksUnavailable(image)) return fail();
    live.add(image.dataset.camera);
    paintStatus();
  });
  image.addEventListener('error', fail);
}

function startRotation() {
  if (reduceMotion() || userTouched || routeCameras.length < 2) return;
  if (rotateTimer) clearInterval(rotateTimer);
  rotateTimer = window.setInterval(() => {
    if (userTouched || document.hidden) return;
    selectedIndex = (selectedIndex + 1) % routeCameras.length;
    renderMarkers();
    renderPreview();
  }, ROTATE_MS);
}

function renderAll() {
  routeCameras = camerasForMode();
  if (wantsSkyway) {
    const skyId = SKYWAY_VIEWS[mode];
    const skyIndex = routeCameras.findIndex(item => Number(item.viewId) === skyId);
    if (skyIndex >= 0) selectedIndex = skyIndex;
  }
  if (selectedIndex >= routeCameras.length) selectedIndex = 0;
  renderChips();
  renderStatus();
  ensureMap(lineCoords(mode));
  renderMarkers();
  renderPreview();
  startRotation();
}

function refresh() {
  if (document.hidden) return;
  document.querySelectorAll('[data-camera]').forEach(image => {
    image.src = `https://511on.ca/map/Cctv/${image.dataset.camera}?t=${Date.now()}`;
  });
}

function applyEstimates(data) {
  estimates = {};
  (data?.cameras || []).forEach(item => {
    estimates[String(item.viewId || item.cameraId)] = item;
  });
}

function waitForLeaflet() {
  return new Promise(resolve => {
    if (window.L) return resolve();
    const timer = window.setInterval(() => {
      if (window.L) {
        clearInterval(timer);
        resolve();
      }
    }, 30);
  });
}

Promise.all([
  waitForLeaflet(),
  fetch('/data/traffic-cameras.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
  fetch('/data/traffic-surface.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
  fetch('/data/traffic-routes.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
  fetch('/data/traffic-estimates.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null)
]).then(([, cameraDoc, surfaceDoc, routeDoc, estimateDoc]) => {
  cameras = cameraDoc?.cameras || [];
  surface = surfaceDoc;
  routesData = routeDoc;
  applyEstimates(estimateDoc);
  renderAll();
});

setInterval(refresh, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
new MutationObserver(() => {
  if (!map) return;
  map.eachLayer(layer => {
    if (layer instanceof window.L.TileLayer) map.removeLayer(layer);
  });
  window.L.tileLayer(tileUrl(), { maxZoom: 18 }).addTo(map);
  if (routeLine) {
    routeLine.setStyle({ color: isDark() ? '#8ec4ea' : '#1d4f78' });
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
