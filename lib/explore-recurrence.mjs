/** Expand recurring Explore events in America/Toronto without creating public URLs. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const FARMERS_MARKET_RECURRENCE = {
  id: 'burlington-farmers-market',
  title: 'Burlington Farmers Market',
  category: 'Market',
  location: 'Burlington Centre, 777 Guelph Line',
  summary: 'Shop local produce, prepared food and handmade goods at the Lions Club market.',
  details: 'The Burlington Lions Club lists the regular market Wednesdays, Fridays and Saturdays from 7:00 a.m. to 2:30 p.m., May 20 through October 24, 2026. An additional Wednesday evening market runs 2:30 to 7:30 p.m. from June 3 through September 30, 2026.',
  bring: [
    'A reusable bag',
    'A shopping list',
    'A way to keep cold items chilled'
  ],
  source: 'https://www.burlingtonlionsclub.ca/burlington-farmers-market',
  sourceName: 'Burlington Lions Club',
  image: 'assets/explore/farmers-market.webp',
  images: [
    'assets/explore/farmers-market.webp',
    'assets/farmers-market-2.png',
    'assets/farmers-market-summer.png'
  ],
  imageAlt: 'Produce and vendors at the Burlington Farmers Market',
  credit: 'Burlington News',
  illustration: false,
  scope: 'Burlington',
  city: 'Burlington',
  venue: 'Burlington Centre',
  travel: 'In Burlington',
  url: '/events/burlington-farmers-market/',
  weight: 5,
  days: ['Wed', 'Fri', 'Sat'],
  seasonStart: '2026-05-20',
  seasonEnd: '2026-10-24',
  open: '07:00',
  close: '14:30',
  evening: {
    days: ['Wed'],
    seasonStart: '2026-06-03',
    seasonEnd: '2026-09-30',
    open: '14:30',
    close: '19:30'
  }
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function ymd(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseYmd(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return { year, month, day };
}

function addDays(year, month, day, count) {
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function weekdayName(year, month, day) {
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

function clockLabel(hhmm) {
  const [hourRaw, minuteRaw] = String(hhmm).split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw || 0);
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  const twelve = hour % 12 || 12;
  return minute ? `${twelve}:${pad(minute)} ${suffix}` : `${twelve} ${suffix}`;
}

function dateHeading(year, month, day, weekday) {
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-CA', {
    month: 'short',
    timeZone: 'UTC'
  });
  return `${weekday}, ${monthName}. ${day}`;
}

function hasEvening(template, date, weekday) {
  const evening = template.evening;
  if (!evening) return false;
  if (!evening.days.includes(weekday)) return false;
  return inRange(date, evening.seasonStart, evening.seasonEnd);
}

export function marketDateLabel(template, year, month, day, weekday) {
  const heading = dateHeading(year, month, day, weekday);
  const regular = `${clockLabel(template.open)} to ${clockLabel(template.close)}`;
  if (hasEvening(template, ymd(year, month, day), weekday)) {
    return `${heading} · ${regular} · Evening market · ${clockLabel(template.evening.open)}–${clockLabel(template.evening.close)}`;
  }
  return `${heading} · ${regular}`;
}

export function expandRecurringEvent(template) {
  const start = parseYmd(template.seasonStart);
  const end = parseYmd(template.seasonEnd);
  const rows = [];
  const imageChoices = Array.isArray(template.images) && template.images.length ? template.images : [template.image].filter(Boolean);
  for (let cursor = start; ymd(cursor.year, cursor.month, cursor.day) <= ymd(end.year, end.month, end.day); cursor = addDays(cursor.year, cursor.month, cursor.day, 1)) {
    const date = ymd(cursor.year, cursor.month, cursor.day);
    const weekday = weekdayName(cursor.year, cursor.month, cursor.day);
    if (!template.days.includes(weekday)) continue;
    const evening = hasEvening(template, date, weekday);
    const endClock = evening ? template.evening.close : template.close;
    const rotatingImage = imageChoices.length ? imageChoices[rows.length % imageChoices.length] : template.image;
    rows.push({
      ...template,
      image: rotatingImage,
      id: `${template.id}-${date}`,
      seriesId: template.id,
      start: `${date}T${template.open}:00-04:00`,
      end: `${date}T${endClock}:00-04:00`,
      dateLabel: marketDateLabel(template, cursor.year, cursor.month, cursor.day, weekday),
      eveningMarket: evening,
      verifiedAt: '2026-08-26T18:00:00-04:00'
    });
  }
  return rows;
}

function normalizeExploreEvent(event) {
  if (event?.id === 'elizabeth-gardens-art-walk-2026') {
    return {
      ...event,
      image: 'assets/art-walk.png',
      imageAlt: 'Artists painting outdoors at a Burlington community art event.',
      credit: 'Burlington News',
      illustration: true
    };
  }
  if (event?.id === 'royal-canadian-circus-2026') {
    return {
      ...event,
      image: 'assets/circus.png',
      imageAlt: 'Royal Canadian Circus event visual.',
      credit: 'Burlington News',
      illustration: true
    };
  }
  return event;
}

export function mergeExploreEvents(data) {
  const events = Array.isArray(data?.events)
    ? data.events.filter(event => !String(event.id || '').startsWith('lions-market-')).map(normalizeExploreEvent)
    : [];
  const templates = [
    ...(Array.isArray(data?.recurring) ? data.recurring : []),
    FARMERS_MARKET_RECURRENCE
  ];
  const seen = new Set();
  const generated = [];
  templates.forEach(template => {
    if (!template?.id || seen.has(template.id)) return;
    seen.add(template.id);
    generated.push(...expandRecurringEvent({ ...FARMERS_MARKET_RECURRENCE, ...template }));
  });
  return [...generated, ...events];
}

export function marketOnDate(events, date) {
  return (events || []).filter(event => String(event.start || '').startsWith(date) && event.seriesId === 'burlington-farmers-market');
}
