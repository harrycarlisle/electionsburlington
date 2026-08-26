const EASTBOUND = new Set(['toronto', 'oakville']);
const WESTBOUND = new Set(['hamilton', 'stoney-creek', 'niagara-falls']);

/** Official Ontario 511 camera 228 — QEW at Guelph Line. */
export const BURLINGTON_ROUTE_ORIGIN = {
  lat: 43.350991,
  lon: -79.804387,
  label: 'QEW at Guelph Line',
  cameraId: 228,
  source: 'Ontario 511'
};

const MAX_CAMERAS = 8;
const MAX_CAMERAS_BY_ROUTE = {
  toronto: 8,
  oakville: 6,
  hamilton: 6,
  'stoney-creek': 6,
  'niagara-falls': 6
};

export const ROUTE_START = {
  toronto: BURLINGTON_ROUTE_ORIGIN,
  oakville: BURLINGTON_ROUTE_ORIGIN,
  hamilton: BURLINGTON_ROUTE_ORIGIN,
  'stoney-creek': BURLINGTON_ROUTE_ORIGIN,
  'niagara-falls': BURLINGTON_ROUTE_ORIGIN
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
  return String(cam.nearestRoad || cam.displayName || cam.cameraName || '')
    .replace(/^(QEW|Gardiner) · /i, '')
    .replace(/^(QEW|Gardiner Expressway) (at|east of|west of|south of|near) /i, '')
    .replace(/^Burlington Skyway — /i, '')
    .replace(/\s+\(\d+\)$/, '')
    .trim();
}

export function cameraDisplayName(cam) {
  const official = String(cam.officialName || cam.cameraName || '').trim();
  if (cam.displayName) return cam.displayName;
  const match = official.match(/^(QEW|Gardiner Expressway)\s+(at|east of|west of|south of|near)\s+(.+)$/i);
  if (match) {
    const road = /^qew$/i.test(match[1]) ? 'QEW' : 'Gardiner';
    const place = match[3].replace(/\s+\(\d+\)$/, '').trim();
    const rel = match[2].toLowerCase();
    if (rel === 'at' || rel === 'near') return `${road} · ${place}`;
    return `${road} ${rel} ${place}`;
  }
  return official.replace(/^QEW QEW\s+/i, 'QEW ');
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

  const limit = options.max || MAX_CAMERAS_BY_ROUTE[routeId] || MAX_CAMERAS;
  if (deduped.length <= limit) return deduped.map((item, index) => ({ ...item, puck: index + 1 }));
  const picked = [];
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round(i * (deduped.length - 1) / (limit - 1));
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
