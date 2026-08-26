const EASTBOUND = new Set(['toronto', 'oakville']);
const WESTBOUND = new Set(['hamilton', 'stoney-creek', 'niagara-falls']);
const GUELPH_QEW = { lat: 43.350991, lon: -79.804387, label: 'QEW at Guelph Line' };
const MAX_CAMERAS = 6;

export const ROUTE_START = {
  toronto: GUELPH_QEW,
  oakville: GUELPH_QEW
};

export function travelDirection(routeId) {
  if (WESTBOUND.has(routeId)) return 'west';
  return 'east';
}

export function cameraHay(cam) {
  return `${cam.cameraName || ''} ${cam.viewName || ''} ${cam.direction || ''} ${cam.municipality || ''}`.toLowerCase();
}

export function cameraConflictsRoute(cam, routeId) {
  const hay = cameraHay(cam);
  const east = travelDirection(routeId) === 'east';
  if (east) {
    if (/fort erie/.test(hay)) return true;
    if (/fort erie/.test(String(cam.municipality || '').toLowerCase())) return true;
    return false;
  }
  return /toronto-bound|toronto bound/.test(hay);
}

export function cameraIsValid(cam, routeId) {
  if (!cam) return false;
  const lat = Number(cam.latitude);
  const lon = Number(cam.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!cam.viewId || !cam.sourceUrl && !cam.viewId) return false;
  if (String(cam.status || '').toLowerCase() === 'disabled') return false;
  if (cameraConflictsRoute(cam, routeId)) return false;
  return true;
}

export function haversine(aLat, aLon, bLat, bLon) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function nearestIndex(line, lat, lon) {
  let best = 0;
  let dist = Infinity;
  line.forEach((point, index) => {
    const next = haversine(point[0], point[1], lat, lon);
    if (next < dist) {
      dist = next;
      best = index;
    }
  });
  return { index: best, metres: dist };
}

export function clipPolyline(line, start) {
  if (!Array.isArray(line) || !line.length || !start) {
    return { line: line || [], startIndex: 0 };
  }
  const near = nearestIndex(line, start.lat, start.lon);
  if (near.metres > 2500) return { line, startIndex: 0 };
  return { line: line.slice(near.index), startIndex: near.index, full: line };
}

export function routeProgress(line, lat, lon) {
  if (!line?.length) return 0;
  const near = nearestIndex(line, lat, lon);
  return near.index;
}

export function incidentMatchesRoute(incident, routeId) {
  const hay = `${incident.direction || ''} ${incident.title || ''} ${incident.rawHeadline || ''}`.toLowerCase();
  if (EASTBOUND.has(routeId) && /fort erie/.test(hay) && !/toronto/.test(hay)) return false;
  if (WESTBOUND.has(routeId) && /toronto-bound|toronto bound/.test(hay) && !/fort erie|niagara|hamilton/.test(hay)) return false;
  return true;
}

export function shortCameraPlace(cam) {
  return String(cam.nearestRoad || cam.cameraName || '')
    .replace(/^QEW (at|east of|west of) /i, '')
    .replace(/^Burlington Skyway — /i, '')
    .trim();
}

export function selectRouteCameras(routeId, routeCameras, inventory, line, options = {}) {
  const byView = new Map((inventory || []).map(item => [String(item.viewId), item]));
  const start = options.start || ROUTE_START[routeId];
  const fullLine = options.fullLine || line;
  const startIndex = options.startIndex || 0;
  const merged = (routeCameras || []).map(item => {
    const full = byView.get(String(item.viewId)) || {};
    return {
      ...full,
      ...item,
      latitude: Number(full.latitude ?? item.latitude),
      longitude: Number(full.longitude ?? item.longitude),
      sourceUrl: full.sourceUrl || `https://511on.ca/map/Cctv/${item.viewId}`
    };
  }).filter(item => cameraIsValid(item, routeId))
    .filter(item => {
      if (!start || !fullLine?.length) return true;
      const onFull = nearestIndex(fullLine, item.latitude, item.longitude);
      if (onFull.metres > 1200) return false;
      return onFull.index >= Math.max(0, startIndex - 3);
    });

  const ordered = merged
    .map(item => ({ ...item, progress: routeProgress(line, item.latitude, item.longitude) }))
    .sort((a, b) => a.progress - b.progress || Number(a.routeOrder || 0) - Number(b.routeOrder || 0));

  const deduped = [];
  for (const cam of ordered) {
    const prev = deduped[deduped.length - 1];
    if (prev && haversine(prev.latitude, prev.longitude, cam.latitude, cam.longitude) < 180) continue;
    deduped.push(cam);
  }

  if (deduped.length <= MAX_CAMERAS) return deduped.map((item, index) => ({ ...item, puck: index + 1 }));
  const picked = [];
  for (let i = 0; i < MAX_CAMERAS; i += 1) {
    const index = Math.round(i * (deduped.length - 1) / (MAX_CAMERAS - 1));
    const cam = deduped[index];
    if (!picked.includes(cam)) picked.push(cam);
  }
  return picked.map((item, index) => ({ ...item, puck: index + 1 }));
}

export function delayFromIncident(item) {
  const fields = [item?.delayMinutes, item?.delay, item?.minutes, item?.status?.delayMinutes];
  for (const value of fields) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return Math.round(number);
  }
  return null;
}
