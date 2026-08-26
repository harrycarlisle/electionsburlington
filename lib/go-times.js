const TORONTO = 'America/Toronto';
const LIVE_STALE_MS = 15 * 60 * 1000;
const REALTIME_GRACE_MIN = 4;

export function torontoParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    nowMin: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

export function parseClockMinutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return (Number(match[1]) % 24) * 60 + Number(match[2]);
}

export function formatClock(value) {
  const minutes = parseClockMinutes(value);
  if (minutes == null) return '';
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = String(minutes % 60).padStart(2, '0');
  const suffix = hour24 >= 12 ? 'p.m.' : 'a.m.';
  return `${hour24 % 12 || 12}:${minute} ${suffix}`;
}

export function hasRealtime(journey) {
  return Boolean(journey?.computedDeparture);
}

export function departureValue(journey) {
  return journey?.computedDeparture || journey?.departure || '';
}

export function journeySortMinutes(journey) {
  const minutes = parseClockMinutes(departureValue(journey));
  if (minutes == null) return null;
  return minutes + (journey?.nextServiceDay ? 1440 : 0);
}

export function isUpcomingJourney(journey, nowMin) {
  const minutes = journeySortMinutes(journey);
  if (minutes == null) return false;
  const grace = hasRealtime(journey) ? REALTIME_GRACE_MIN : 0;
  return minutes > nowMin - grace;
}

export function delayMinutes(journey) {
  const scheduled = parseClockMinutes(journey?.departure);
  const computed = parseClockMinutes(journey?.computedDeparture);
  if (scheduled == null || computed == null || !journey?.computedDeparture) return null;
  const delta = computed - scheduled;
  return delta > 0 ? delta : null;
}

export function findRoute(data, origin, dest) {
  const allRoutes = Array.isArray(data?.routes) ? data.routes : [];
  return allRoutes.find(item =>
    String(item.destination?.stopCode || '').toUpperCase() === dest
    && (!origin || String(item.origin?.stopCode || '').toUpperCase() === origin)
  ) || allRoutes.find(item => String(item.destination?.stopCode || '').toUpperCase() === dest) || null;
}

export function upcomingJourneys(route, nowMin) {
  const all = Array.isArray(route?.journeys) ? route.journeys : [];
  return all
    .filter(item => isUpcomingJourney(item, nowMin))
    .sort((a, b) => (journeySortMinutes(a) ?? 9999) - (journeySortMinutes(b) ?? 9999));
}

export function isLiveStale(data, now = new Date()) {
  const kind = String(data?.dataKind || '').toLowerCase();
  if (kind !== 'live' && kind !== 'realtime') return false;
  const generated = Date.parse(data?.generatedAt || '');
  if (!Number.isFinite(generated)) return true;
  return (now.getTime() - generated) > LIVE_STALE_MS;
}

export function officialCause(text) {
  const hay = String(text || '');
  if (!hay) return '';
  if (/police investigation|investigating/i.test(hay)) return 'Police investigation';
  if (/emergency response|ambulance|hazmat/i.test(hay)) return 'Emergency response';
  if (/\bpedestrian|trespass/i.test(hay)) return 'Pedestrian incident';
  if (/track issue|broken rail/i.test(hay)) return 'Track issue';
  if (/signal (issue|problem)/i.test(hay)) return 'Signal issue';
  if (/mechanical|train fault|disabled train/i.test(hay)) return 'Mechanical issue';
  if (/weather|storm|snow|ice/i.test(hay)) return 'Weather';
  return '';
}

export function buildGoModel(data, now = new Date()) {
  const clock = torontoParts(now);
  const alert = Array.isArray(data?.alerts) && data.alerts[0];
  const alertText = `${alert?.headline || ''} ${alert?.detail || ''} ${alert?.description || ''}`;
  const inboundPreferred = clock.hour >= 15;
  const outbound = findRoute(data, 'BU', 'UN');
  const inbound = findRoute(data, 'UN', 'BU');
  const outboundNext = upcomingJourneys(outbound, clock.nowMin);
  const inboundNext = upcomingJourneys(inbound, clock.nowMin);
  const chosenRoute = inboundPreferred && inboundNext.length ? inbound : outbound;
  const chosenList = inboundPreferred && inboundNext.length ? inboundNext : outboundNext;
  const journey = chosenList[0] || null;
  const staleLive = isLiveStale(data, now);
  const scheduledOnly = staleLive
    || String(data?.dataKind || '').toLowerCase() === 'scheduled'
    || (journey && journey.scheduled !== false && !journey.computedDeparture);
  const critical = Boolean(alert) && /cancel|cancelled|suspend|stopped|stoppage|bus replac/i.test(alertText);
  const delay = journey && !scheduledOnly ? delayMinutes(journey) : null;
  const realtime = Boolean(journey?.computedDeparture) && !scheduledOnly;
  let status = '';
  if (critical) status = '';
  else if (!journey) status = '';
  else if (delay) status = `+${delay} min`;
  else if (realtime && /on time|ontime|arrived/i.test(String(journey.departureStatus || ''))) status = 'On time';
  else if (realtime) status = String(journey.departureStatus || 'Live');
  else status = 'Scheduled';

  const origin = chosenRoute?.origin?.label || (inboundPreferred && inbound ? 'Union' : 'Burlington');
  const dest = chosenRoute?.destination?.label || (inboundPreferred && inbound ? 'Burlington' : 'Union');
  const destCode = chosenRoute?.destination?.stopCode || 'UN';
  const unavailable = !critical && !journey;
  const day = clock.day;
  const goTripUrl = `https://www.gotransit.com/en/see-schedules?tripPoint=7700&departure=BU&destination=${encodeURIComponent(destCode)}&date=${encodeURIComponent(day)}&transfers=true`;

  return {
    alert: Boolean(alert),
    critical,
    severe: critical,
    headline: critical ? (alert.headline || 'Service suspended') : `${origin} → ${dest}`,
    time: critical || unavailable ? '' : formatClock(departureValue(journey)),
    status: unavailable ? '' : status,
    detail: critical
      ? (alert.detail || alert.description || 'Lakeshore West service update')
      : (unavailable ? 'Schedule unavailable' : (officialCause(alertText) || (journey?.platform ? `Platform ${journey.platform}` : ''))),
    scheduled: unavailable ? false : scheduledOnly,
    unavailable,
    dataKind: staleLive ? 'stale' : (data?.dataKind || (scheduledOnly ? 'scheduled' : 'live')),
    url: critical ? (data?.liveStatusUrl || 'https://www.gotransit.com/en/see-schedules') : goTripUrl,
    cause: officialCause(alertText),
    journey
  };
}

if (typeof window !== 'undefined') {
  window.BNGoTimes = {
    torontoParts,
    parseClockMinutes,
    formatClock,
    isUpcomingJourney,
    upcomingJourneys,
    findRoute,
    delayMinutes,
    departureValue,
    officialCause,
    isLiveStale,
    buildGoModel
  };
}
