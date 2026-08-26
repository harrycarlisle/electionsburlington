(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CalendarRank = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TORONTO_TZ = 'America/Toronto';
  const SHORT_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

  function torontoDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  function eventCoversDay(event, key) {
    if (!event || !key) return false;
    const start = torontoDayKey(event.start);
    const end = torontoDayKey(event.end || event.start);
    return Boolean(start && end && start <= key && key <= end);
  }

  function eventStartsOnDay(event, key) {
    return Boolean(event) && torontoDayKey(event.start) === key;
  }

  function formatDayLabel(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length < 3 || !parts[1] || !parts[2]) return '';
    return `${SHORT_MONTHS[parts[1] - 1]} ${parts[2]}`;
  }

  function rankEventsForDate(list, selectedKey, now) {
    const todayKey = torontoDayKey(now || new Date());
    const upcoming = (list || []).filter(event => torontoDayKey(event.end || event.start) >= todayKey);
    const onDay = [];
    const later = [];
    upcoming.forEach(event => {
      if (eventCoversDay(event, selectedKey)) onDay.push(event);
      else if (torontoDayKey(event.start) > selectedKey) later.push(event);
    });
    onDay.sort((a, b) => {
      const startRank = (eventStartsOnDay(a, selectedKey) ? 0 : 1) - (eventStartsOnDay(b, selectedKey) ? 0 : 1);
      if (startRank) return startRank;
      return new Date(a.start) - new Date(b.start);
    });
    later.sort((a, b) => new Date(a.start) - new Date(b.start));
    return { onDay, later, ranked: onDay.concat(later) };
  }

  function emptyDayMessage(selectedKey, nextEvent) {
    const label = formatDayLabel(selectedKey);
    const lines = [`No events found for ${label}.`];
    if (nextEvent && nextEvent.title) lines.push(`Next event: ${nextEvent.title}`);
    return lines;
  }

  return {
    TORONTO_TZ,
    torontoDayKey,
    eventCoversDay,
    eventStartsOnDay,
    formatDayLabel,
    rankEventsForDate,
    emptyDayMessage
  };
});
