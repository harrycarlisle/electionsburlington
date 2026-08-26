/** Context ranking for Explore “I’m bored”. Burlington local time. */

export const LATE_EVENING_HOUR = 21.5;

export function ideaTags(idea) {
  return `${idea?.category || ''} ${idea?.indoorOutdoor || ''} ${idea?.cost || ''} ${(idea?.tags || []).join(' ')}`.toLowerCase();
}

export function isIndoor(idea) {
  return idea?.indoorOutdoor === 'indoor' || idea?.safety === 'indoor' || /\bindoor\b/.test(ideaTags(idea));
}

export function isIsolatedOutdoor(idea) {
  if (isIndoor(idea)) return false;
  if (idea?.safety === 'public' || idea?.nightOk || idea?.staffedNight) return false;
  if (idea?.safety === 'isolated') return true;
  const tags = ideaTags(idea);
  return /isolated|secluded|trail|escarpment|conservation|lookout|boardwalk|shoreline|wooded/.test(tags)
    || /mount-nemo|kerncliff|beachway|burloak|fishway|cassiopeia/.test(`${idea?.id || ''} ${idea?.placeName || ''}`);
}

export function isNightAppropriate(idea) {
  if (idea?.nightOk || idea?.staffedNight) return true;
  const tags = ideaTags(idea);
  return /night|stargaz|eclipse|festival|concert|movie|market|downtown|rink/.test(tags) && !isIsolatedOutdoor(idea);
}

export function parseHour(value) {
  if (typeof value === 'number') return value;
  const match = String(value || '').match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) + Number(match[2] || 0) / 60;
}

export function isOpenNow(idea, now) {
  const hours = idea?.hours;
  if (!hours) return null;
  const days = hours.days || hours.openDays;
  if (Array.isArray(days) && days.length && !days.includes(now.weekday) && !days.includes(now.weekdayIndex)) {
    return false;
  }
  const open = parseHour(hours.open);
  const close = parseHour(hours.close);
  if (open == null || close == null) return null;
  const current = now.hour + (now.minute || 0) / 60;
  if (close <= open) return current >= open || current < close;
  return current >= open && current < close;
}

export function isActive(idea, now) {
  if (idea?.activeFrom && idea.activeFrom > now.date) return false;
  if (idea?.activeUntil && idea.activeUntil < now.date) return false;
  if (idea?.eventEnd && now.iso && idea.eventEnd < now.iso) return false;
  return true;
}

export function afterDarkMode(now) {
  if (now.isDaylight) return 'daylight';
  const hour = now.hour + (now.minute || 0) / 60;
  if (hour >= LATE_EVENING_HOUR || hour < 5) return 'late';
  return 'evening';
}

export function scoreIdea(idea, now, weather = {}) {
  const pref = now.prefs?.[idea.id] || {};
  if (pref.skip) return 0;
  if (!isActive(idea, now)) return 0;

  const tags = ideaTags(idea);
  const indoor = isIndoor(idea);
  const isolated = isIsolatedOutdoor(idea);
  const nightOk = isNightAppropriate(idea);
  const mode = afterDarkMode(now);
  const open = isOpenNow(idea, now);

  if (weather.thunderstorm && !indoor) return 0;
  if (weather.snow && /trail|escarpment|lookout|boardwalk/.test(tags)) return 0;
  if (weather.raining && isolated) return 0;
  if (mode !== 'daylight' && isolated && !nightOk) return 0;
  if (mode === 'late' && !indoor && !nightOk && !idea.staffedNight) return 0;
  if (open === false) return 0;

  let score = 12;
  if (pref.like) score += 8;
  if (pref.planned) score += 3;
  if (open === true) score += 6;
  if (idea.cost === 'free') score += 1;

  if (weather.raining && indoor) score += 8;
  if (weather.raining && !indoor) score -= 6;
  if (weather.heat && indoor) score += 5;
  if (weather.heat && /trail|escarpment/.test(tags)) score -= 4;
  if (weather.clear && mode === 'daylight' && /waterfront|park|sunset/.test(tags) && !isolated) score += 4;
  if (weather.clear && nightOk) score += 3;

  if (mode === 'daylight' && /night|stargaz/.test(tags) && !idea.staffedNight) score -= 4;
  if (mode !== 'daylight' && nightOk) score += 6;
  if (mode !== 'daylight' && indoor) score += 4;

  const weekend = now.weekday === 'Sat' || now.weekday === 'Sun';
  if (weekend && /event|market|family/.test(tags)) score += 5;
  if (!weekend && /quick|coffee|food|downtown/.test(tags)) score += 2;
  const summer = now.month >= 6 && now.month <= 8;
  const winter = now.month === 12 || now.month <= 2;
  if (summer && /waterfront|outdoor|market/.test(tags) && mode === 'daylight') score += 3;
  if (winter && indoor) score += 4;
  if (idea.scope === 'Burlington' || !idea.scope) score += 2;

  return Math.max(score, 0);
}

export function eligibleIdeas(ideas, now, weather = {}) {
  return ideas.filter(idea => scoreIdea(idea, now, weather) > 0);
}

export function pickNext(ideas, now, weather = {}, seen = [], avoidId = '', random = Math.random) {
  const prefs = now.prefs || {};
  const open = ideas.filter(idea => !(prefs[idea.id] || {}).skip);
  const usable = open.length ? open : ideas;
  const ranked = usable
    .map(idea => ({ idea, score: scoreIdea(idea, now, weather) }))
    .filter(item => item.score > 0 && item.idea.id !== avoidId)
    .sort((a, b) => b.score - a.score || a.idea.id.localeCompare(b.idea.id));
  if (!ranked.length) return null;
  const top = ranked.filter(item => item.score >= ranked[0].score - 4);
  const fresh = top.filter(item => !seen.includes(item.idea.id));
  const pool = (fresh.length ? fresh : top);
  const ticket = random() * pool.reduce((sum, item) => sum + item.score, 0);
  let cursor = ticket;
  for (const item of pool) {
    cursor -= item.score;
    if (cursor <= 0) return item.idea;
  }
  return pool[0].idea;
}
