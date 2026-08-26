const EASTBOUND = new Set(['toronto', 'oakville']);
const WESTBOUND = new Set(['hamilton', 'stoney-creek', 'niagara-falls']);
const GUELPH_QEW = { lat: 43.350991, lon: -79.804387, label: 'QEW at Guelph Line' };
const NORTHSHORE_QEW = { lat: 43.31469, lon: -79.80572, label: 'QEW westbound at North Shore' };
const MAX_CAMERAS = 6;

export const ROUTE_START = {
  toronto: GUELPH_QEW,
  oakville: GUELPH_QEW,
  hamilton: NORTHSHORE_QEW,
  'stoney-creek': NORTHSHORE_QEW,
  'niagara-falls': NORTHSHORE_QEW
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

export function incidentDirectionSide(incident) {
  const hay = `${incident?.direction || ''} ${incident?.title || ''} ${incident?.rawHeadline || ''}`.toLowerCase();
  const east = /toronto-bound|toronto bound|eastbound|east bound/.test(hay);
  const west = /fort erie|niagara-bound|hamilton.?bound|westbound|west bound/.test(hay);
  if (east && !west) return 'east';
  if (west && !east) return 'west';
  if (/toronto/.test(hay) && !west) return 'east';
  return 'unknown';
}

export function incidentFacilityKind(incident) {
  const named = String(incident?.facility || '').toLowerCase();
  if (named === 'on-ramp' || named === 'off-ramp') return named;
  const hay = `${incident?.title || ''} ${incident?.rawHeadline || ''} ${incident?.facility || ''}`.toLowerCase();
  if (/off-ramp|off ramp/.test(hay)) return 'off-ramp';
  if (/on-ramp|on ramp/.test(hay)) return 'on-ramp';
  if (/\bramp\b/.test(hay)) return 'ramp';
  return 'mainline';
}

export function shortIncidentPlace(incident) {
  return String(incident?.nearestRoad || '')
    .replace(/\s+(Drive|Rd|Road|Avenue|Ave|Street|St|Boulevard|Blvd|Line)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function incidentFeatureLabel(incident) {
  if (!incident) return '';
  const facility = incidentFacilityKind(incident);
  const direction = String(incident.direction || '').trim();
  const place = incident.nearestRoad || '';
  const hay = `${incident.title || ''} ${incident.rawHeadline || ''}`;
  const lane = hay.match(/((?:right|left|centre|center|two|three|\d+)\s+(?:mainline\s+)?lanes?)\s+(closed|blocked)/i);
  if (lane) {
    return [direction, `${lane[1].toLowerCase()} ${lane[2].toLowerCase()}`].filter(Boolean).join(' ');
  }
  if (facility === 'on-ramp' || facility === 'off-ramp' || facility === 'ramp') {
    const feature = facility === 'ramp' ? 'ramp' : facility;
    return [direction, `${feature} closed`, place ? `at ${place}` : ''].filter(Boolean).join(' ');
  }
  if (incident.type === 'collision') {
    return place ? `Collision near ${place}` : (incident.title || 'Collision');
  }
  if (incident.type === 'closure') {
    return place ? `Mainline closure near ${place}` : (incident.title || 'Closure');
  }
  if (incident.type === 'construction') {
    return place ? `Construction near ${place}` : (incident.title || 'Construction');
  }
  return incident.title || 'Incident';
}

export function incidentRelevance(incident, routeId) {
  if (!incident) return 'none';
  const side = incidentDirectionSide(incident);
  const travel = travelDirection(routeId);
  if (side !== 'unknown' && side !== travel) return 'opposite';
  if (!incidentMatchesRoute(incident, routeId)) return 'none';

  const facility = incidentFacilityKind(incident);
  if (delayFromIncident(incident)) return 'through';
  if (facility === 'on-ramp' || facility === 'off-ramp' || facility === 'ramp') return 'local';
  if (incident.type === 'collision' || incident.type === 'lanes') return 'through';
  if (incident.type === 'closure') return 'through';
  return 'local';
}

export function incidentOnRouteMap(incident, routeId) {
  const relevance = incidentRelevance(incident, routeId);
  return relevance === 'through' || relevance === 'local';
}

export function incidentNearLine(incident, line, maxMetres = 2200) {
  const lat = Number(incident?.latitude);
  const lon = Number(incident?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!line?.length) return true;
  return nearestIndex(line, lat, lon).metres <= maxMetres;
}

export function incidentsForRoute(routeId, routeIncidents, allIncidents, line) {
  const seen = new Set();
  const list = [];
  for (const item of [...(routeIncidents || []), ...(allIncidents || [])]) {
    const id = String(item?.id || `${item?.title}|${item?.latitude}|${item?.longitude}`);
    if (seen.has(id)) continue;
    if (!incidentOnRouteMap(item, routeId)) continue;
    if (!incidentNearLine(item, line)) continue;
    seen.add(id);
    list.push(item);
  }
  return list.slice(0, 4);
}

export function impactLabel(relevance) {
  if (relevance === 'local') return 'Local access affected';
  if (relevance === 'opposite') return 'Opposite direction';
  if (relevance === 'through') return 'Likely affecting traffic';
  return '';
}

function headlineWithPlace(incident, kind) {
  const place = shortIncidentPlace(incident);
  if (!place) {
    if (kind === 'major') return 'Major delay';
    if (kind === 'heavy') return 'Heavy traffic';
    if (kind === 'slow') return 'Some slowing';
    return 'Moving well';
  }
  if (kind === 'major') return `Major delay near ${place}`;
  if (kind === 'heavy') return `Heavy near ${place}`;
  if (kind === 'slow') return `Slower near ${place}`;
  return 'Moving well';
}

export function officialCongestionTrusted(source) {
  return /travel[- ]?time|speed data|official congestion|mto speed/i.test(String(source || ''));
}

export function routeDriveStatus(incidents, routeId, options = {}) {
  const list = (incidents || []).filter(Boolean);
  const classified = list.map(item => ({
    item,
    relevance: incidentRelevance(item, routeId)
  }));
  const through = classified.filter(row => row.relevance === 'through').map(row => row.item);
  const local = classified.filter(row => row.relevance === 'local').map(row => row.item);
  const opposite = classified.filter(row => row.relevance === 'opposite').map(row => row.item);

  const officialDelay = Math.max(
    0,
    ...list.map(item => delayFromIncident(item) || 0),
    delayFromIncident(options.officialStatus) || 0
  );
  const looks = String(options.officialLooks || options.officialStatus?.looks || '').toLowerCase();
  const trustLooks = officialCongestionTrusted(options.source) && ['heavy', 'moderate', 'slow', 'light', 'clear'].includes(looks);

  let headline = 'Moving well';
  let level = 'clear';
  let evidence = 'no-congestion-data';

  if (officialDelay >= 20) {
    headline = headlineWithPlace(through[0], 'major');
    level = 'delay';
    evidence = 'official-delay';
  } else if (officialDelay >= 10) {
    headline = headlineWithPlace(through[0], 'heavy');
    level = 'delay';
    evidence = 'official-delay';
  } else if (officialDelay >= 5) {
    headline = headlineWithPlace(through[0], 'slow');
    level = 'watch';
    evidence = 'official-delay';
  } else if (trustLooks && looks === 'heavy') {
    headline = headlineWithPlace(through[0], 'heavy');
    level = 'delay';
    evidence = 'official-congestion';
  } else if (trustLooks && (looks === 'moderate' || looks === 'slow')) {
    headline = headlineWithPlace(through[0], 'slow');
    level = 'watch';
    evidence = 'official-congestion';
  } else if (through.length) {
    const lead = through[0];
    const place = shortIncidentPlace(lead);
    if (lead.type === 'closure' && incidentFacilityKind(lead) === 'mainline') {
      headline = place ? `Heavy near ${place}` : 'Heavy traffic';
      level = 'delay';
    } else {
      headline = place ? `Some slowing near ${place}` : 'Some slowing';
      level = 'watch';
    }
    evidence = 'official-mainline-incident';
  }

  const primary = through[0] || local[0] || null;
  return {
    headline,
    level,
    secondary: primary ? incidentFeatureLabel(primary) : '',
    impact: primary ? impactLabel(incidentRelevance(primary, routeId)) : '',
    minutes: officialDelay || null,
    primaryIncident: primary,
    through,
    local,
    opposite,
    evidence
  };
}

export function cameraTrafficState(cam, options = {}) {
  if (options.unavailable) {
    return { label: '', puck: 'unavailable', live: false };
  }
  const official = String(options.officialState || '').toLowerCase();
  if (official === 'severe' || official === 'heavy') {
    return { label: 'Heavy traffic', puck: 'heavy', live: true };
  }
  if (official === 'slow' || official === 'moderate') {
    return { label: 'Some slowing', puck: 'slow', live: true };
  }
  if (official === 'clear' || official === 'light' || official === 'normal') {
    return { label: 'Moving well', puck: 'normal', live: true };
  }
  return { label: '', puck: 'unknown', live: true };
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
