const TORONTO = 'America/Toronto';

export const NEWEST_WINDOW_MS = 6 * 60 * 60 * 1000;
export const AGING_WINDOW_MS = 12 * 60 * 60 * 1000;
export const DIVERSITY_TOLERANCE_MS = 90 * 60 * 1000;
export const POPULAR_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const MIN_POPULAR_SAMPLE = 40;

export function torontoYmd(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value instanceof Date ? value : new Date(value));
}

export function parseStoryTime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Date.parse(`${raw}T12:00:00-04:00`);
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
}

export function effectiveFreshnessTimestamp(item) {
  return parseStoryTime(item?.lastMeaningfulUpdate)
    || parseStoryTime(item?.publishedAt)
    || parseStoryTime(item?.datePublished)
    || parseStoryTime(item?.published)
    || parseStoryTime(item?.activeFrom);
}

export function freshnessAgeMs(item, now = Date.now()) {
  const time = effectiveFreshnessTimestamp(item);
  if (!time) return Infinity;
  return now - time;
}

export function isEligibleForNewest(item, now = Date.now(), windowMs = NEWEST_WINDOW_MS) {
  if (!item?.id || item.status === 'expired') return false;
  const age = freshnessAgeMs(item, now);
  return age >= 0 && age <= windowMs;
}

export function relativeTime(value, now = Date.now()) {
  const time = parseStoryTime(value) || effectiveFreshnessTimestamp({published: value, publishedAt: value});
  if (!time) return '';
  if (time > now + 120000) return '';
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 60) return minutes <= 1 ? '1 min ago' : `${minutes} min ago`;
  const hours = Math.floor((now - time) / 3600000);
  const day = torontoYmd(time);
  const today = torontoYmd(now);
  if (day === today) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const yesterday = torontoYmd(now - 24 * 60 * 60 * 1000);
  if (day === yesterday) return 'Yesterday';
  const days = Math.max(2, Math.floor((now - time) / 86400000));
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO,
    month: 'short',
    day: 'numeric'
  }).format(new Date(time)).replace(/\b([A-Za-z]{3})\s/, '$1. ');
}

export function categoryKey(item) {
  if (item?.topic) return String(item.topic).toLowerCase();
  return String(item?.label || 'burlington').toLowerCase().replace(/\s+/g, '-');
}

export function selectNewest(items, options = {}) {
  const now = options.now ?? Date.now();
  const limit = options.limit ?? 3;
  const heroId = options.heroId;
  const windowMs = options.windowMs ?? NEWEST_WINDOW_MS;
  const eligible = (items || [])
    .filter(item => item?.id && item.id !== heroId && isEligibleForNewest(item, now, windowMs))
    .map(item => ({item, ts: effectiveFreshnessTimestamp(item)}))
    .sort((a, b) => b.ts - a.ts);

  const chronologicalIds = eligible.map(row => row.item.id);
  const selected = [];
  const remaining = [...eligible];

  while (remaining.length && selected.length < limit) {
    const newest = remaining[0];
    const last = selected[selected.length - 1];
    let choice = newest;
    if (last && categoryKey(last.item) === categoryKey(newest.item)) {
      const alternative = remaining.find(row => (
        categoryKey(row.item) !== categoryKey(newest.item)
        && (newest.ts - row.ts) <= DIVERSITY_TOLERANCE_MS
      ));
      if (alternative) choice = alternative;
    }
    selected.push(choice);
    const index = remaining.indexOf(choice);
    remaining.splice(index, 1);
  }

  return {
    items: selected.map(row => row.item),
    chronologicalIds,
    diversityChangedOrder: selected.some((row, index) => row.item.id !== chronologicalIds[index])
  };
}

export function popularityConfidence(sampleSize) {
  const sample = Number(sampleSize) || 0;
  if (sample < 8) return 0.2;
  if (sample < MIN_POPULAR_SAMPLE) return 0.3;
  return 0.7;
}

export function popularityScore(stats = {}, editorialScore = 0, now = Date.now()) {
  const reads1h = Number(stats.reads1h) || 0;
  const reads6h = Number(stats.reads6h) || 0;
  const reads24h = Number(stats.reads24h) || 0;
  const reads72h = Number(stats.reads72h) || 0;
  const completions = Number(stats.completions) || 0;
  const relatedClicks = Number(stats.relatedClicks) || 0;
  const ageHours = Math.max(1 / 12, (now - (Number(stats.firstSeen) || now)) / 3600000);
  const velocity = (reads24h + 4) / (ageHours + 4);
  const behaviour = (
    velocity * 0.40
    + reads6h * 0.25
    + completions * 0.15
    + relatedClicks * 0.10
    + (Number(editorialScore) || 0) * 0.10
  );
  const age = now - (Number(stats.lastSeen) || Number(stats.firstSeen) || now);
  if (age > POPULAR_MAX_AGE_MS && reads6h < 3) return Number(editorialScore) || 0;
  const confidence = popularityConfidence(reads24h + reads1h);
  return behaviour * confidence + (Number(editorialScore) || 0) * (1 - confidence);
}

export function canLabelMostRead(sampleSize) {
  return (Number(sampleSize) || 0) >= MIN_POPULAR_SAMPLE;
}

export function uniqueCameraCount(list) {
  const ids = new Set();
  (list || []).forEach(cam => {
    const key = cam?.viewId || cam?.cameraId;
    if (key != null && key !== '') ids.add(String(key));
  });
  return ids.size;
}
