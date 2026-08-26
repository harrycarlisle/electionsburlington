(() => {
  const TORONTO = 'America/Toronto';

  function torontoNow(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TORONTO,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type)?.value || '';
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    return {
      weekday: get('weekday'),
      day: `${get('year')}-${get('month')}-${get('day')}`,
      hour,
      minute,
      minutes: hour * 60 + minute
    };
  }

  function formatClock(minutes) {
    const hour24 = Math.floor(minutes / 60) % 24;
    const minute = String(minutes % 60).padStart(2, '0');
    return `${hour24 % 12 || 12}:${minute} ${hour24 >= 12 ? 'p.m.' : 'a.m.'}`;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function paintChip(id, label, kind) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = label;
    node.className = `status-chip ${kind}`;
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(url);
    return response.json();
  }

  function parkingAnswer(clock, snow) {
    const overnight = clock.minutes >= 60 && clock.minutes < 360;
    if (snow?.declared) {
      return {
        chip: 'NOT TONIGHT',
        kind: 'bad',
        answer: 'A snow event is declared. On-street parking is prohibited until the City says the event is over. Permits and exemptions do not apply.'
      };
    }
    if (overnight) {
      return {
        chip: 'NOT ON-STREET',
        kind: 'bad',
        answer: 'It is between 1 a.m. and 6 a.m. On-street parking is not allowed unless a sign says otherwise or you have a valid exemption or residential permit.'
      };
    }
    const weekend = clock.weekday === 'Sat' || clock.weekday === 'Sun';
    const afterSix = clock.minutes >= 18 * 60 || clock.minutes < 9 * 60;
    if (clock.weekday === 'Sun' || (clock.weekday !== 'Sat' && afterSix)) {
      return {
        chip: 'DOWNTOWN FREE',
        kind: 'ok',
        answer: clock.weekday === 'Sun'
          ? 'Sunday: downtown on-street spaces, municipal lots and the Waterfront Parking Garage are free. Overnight on-street parking still needs an exemption or permit after 1 a.m.'
          : 'After 6 p.m. on a weekday, downtown municipal lots and the garage are free. Overnight on-street parking still needs an exemption or permit from 1 a.m. to 6 a.m.'
      };
    }
    if (clock.weekday === 'Sat' && clock.minutes >= 9 * 60 && clock.minutes < 18 * 60) {
      return {
        chip: 'SATURDAY RULES',
        kind: 'warn',
        answer: 'Saturday 9 a.m. to 6 p.m.: pay in Lots 1, 4 and 5 and at on-street meters. Other lots and the 414 Locust Street garage are free.'
      };
    }
    if (!weekend && clock.minutes >= 9 * 60 && clock.minutes < 18 * 60) {
      return {
        chip: 'PAID UNTIL 6',
        kind: 'warn',
        answer: 'Weekday paid hours are on. Downtown lots and the garage are generally paid from 9 a.m. to 6 p.m. After 6 p.m. they are free.'
      };
    }
    return {
      chip: 'CHECK SIGNS',
      kind: 'neutral',
      answer: 'Use the posted sign and the City parking map. Overnight on-street parking still needs an exemption or permit from 1 a.m. to 6 a.m.'
    };
  }

  async function initParking() {
    const clock = torontoNow();
    let snow = { declared: false };
    try { snow = await loadJson('/data/snow-status.json'); } catch (_) {}
    const state = parkingAnswer(clock, snow);
    paintChip('parkingChip', state.chip, state.kind);
    setText('parkingAnswer', state.answer);
    setText('parkingClock', `${clock.weekday} ${formatClock(clock.minutes)} in Burlington`);
    paintChip('snowChip', snow.declared ? 'SNOW EVENT' : 'NO SNOW EVENT', snow.declared ? 'bad' : 'ok');
    setText('snowDetail', snow.detail || snow.label || '');
    setText('parkingUpdated', `Updated ${clock.day} ${formatClock(clock.minutes)}`);
  }

  function beachKind(status) {
    if (status === 'SAFE') return 'ok';
    if (status === 'NOT_RECOMMENDED') return 'bad';
    return 'neutral';
  }

  async function initBeach() {
    const clock = torontoNow();
    let data;
    try { data = await loadJson('/data/beach-status.json'); } catch (_) { return; }
    const inSeason = clock.day >= data.seasonStart && clock.day <= data.seasonEnd;
    const root = document.getElementById('beachCards');
    if (root) {
      root.innerHTML = data.beaches.map(beach => {
        const status = inSeason ? beach.status : 'NO_CURRENT_SAMPLE';
        const label = inSeason ? beach.statusLabel : 'NO CURRENT SAMPLE';
        const sample = beach.sampleDate ? `Sample date: ${beach.sampleDate}` : 'No current official sample is on file.';
        return `<article class="authority-card"><h3>${beach.name}</h3><p><span class="status-chip ${beachKind(status)}">${label}</span></p><p>${sample}</p><p>${beach.address}</p><p>${inSeason ? beach.detail : 'Halton’s routine beach sampling season runs from June through Labour Day weekend. After that, treat the official page as the source.'}</p></article>`;
      }).join('');
    }
    const anySafe = inSeason && data.beaches.every(beach => beach.status === 'SAFE');
    const anyBad = inSeason && data.beaches.some(beach => beach.status === 'NOT_RECOMMENDED');
    paintChip('beachChip', anyBad ? 'NOT RECOMMENDED' : anySafe ? 'SAFE' : 'NO CURRENT SAMPLE', anyBad ? 'bad' : anySafe ? 'ok' : 'neutral');
    setText('beachUpdated', `Checked ${data.updated}`);
  }

  function journeyRow(journey) {
    const time = window.BNGoTimes?.formatClock(window.BNGoTimes.departureValue(journey)) || journey.departure;
    const realtime = Boolean(journey.computedDeparture);
    const delay = window.BNGoTimes?.delayMinutes(journey);
    const status = delay ? `+${delay} min` : realtime ? (journey.departureStatus || 'Live') : 'Scheduled';
    return `<tr><td>${time}</td><td>${journey.arrival ? window.BNGoTimes.formatClock(journey.arrival) : '—'}</td><td>${journey.duration || '—'}</td><td>${status}</td><td>${journey.platform || '—'}</td></tr>`;
  }

  async function initGo() {
    if (!window.BNGoTimes) return;
    const clock = torontoNow();
    let data;
    try { data = await loadJson('/data/go-status.json'); } catch (_) { return; }
    const route = window.BNGoTimes.findRoute(data, 'BU', 'UN');
    const upcoming = window.BNGoTimes.upcomingJourneys(route, clock.minutes).slice(0, 6);
    const body = document.getElementById('goRows');
    if (body) {
      body.innerHTML = upcoming.length
        ? upcoming.map(journeyRow).join('')
        : '<tr><td colspan="5">No later Burlington → Union times are in the current file. Check GO Transit.</td></tr>';
    }
    const first = upcoming[0];
    const stale = window.BNGoTimes.isLiveStale?.(data) || String(data.dataKind || '').toLowerCase() === 'scheduled';
    paintChip('goChip', first ? (stale ? 'SCHEDULED' : 'LIVE') : 'UNAVAILABLE', first ? (stale ? 'warn' : 'ok') : 'neutral');
    setText('goNext', first ? `Next Burlington → Union ${window.BNGoTimes.formatClock(window.BNGoTimes.departureValue(first))}` : 'No later departure in this file');
    setText('goKind', stale ? 'Showing scheduled times, not live predictions.' : 'Showing the current GO file, including realtime when present.');
    setText('goUpdated', `Last updated ${data.generatedAt || clock.day}`);
    const reason = window.BNGoTimes.officialCause?.((data.alerts || []).map(item => `${item.headline || ''} ${item.detail || ''}`).join(' '));
    setText('goReason', reason || '');
  }

  function weekendWindow(clock) {
    const date = new Date(`${clock.day}T12:00:00`);
    const weekday = date.getDay();
    const toFriday = (5 - weekday + 7) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() + (weekday === 0 || weekday === 6 ? 0 : toFriday));
    if (weekday === 0) start.setDate(date.getDate() - 2);
    if (weekday === 6) start.setDate(date.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    end.setHours(23, 59, 59, 0);
    return { start, end };
  }

  async function initWeekend() {
    const clock = torontoNow();
    let data;
    try { data = await loadJson('/data/explore-events.json'); } catch (_) { return; }
    const { start, end } = weekendWindow(clock);
    const events = (data.events || []).filter(event => {
      const begin = Date.parse(event.start);
      return begin >= start.getTime() && begin <= end.getTime();
    }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const root = document.getElementById('weekendList');
    if (!root) return;
    root.innerHTML = events.length ? events.map(event => {
      const href = event.slug ? `/events/${event.slug}/` : '/explore/';
      return `<article class="authority-card event-card"><p class="authority-kicker">${event.category} · ${event.scope}</p><h3><a href="${href}">${event.title}</a></h3><p>${event.dateLabel}</p><p>${event.location}</p><p>${event.summary}</p></article>`;
    }).join('') : '<p>No verified weekend events are in the current calendar. Check Explore for the next 7 days.</p>';
    setText('weekendRange', `${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} to ${end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`);
  }

  function initTax() {
    const input = document.getElementById('taxAssessment');
    const out = document.getElementById('taxOut');
    if (!input || !out) return;
    const paint = () => {
      const value = Number(String(input.value).replace(/[^0-9.]/g, ''));
      if (!value) { out.textContent = 'Enter a current value assessment to see the City’s published per-$100,000 figures applied to that home.'; return; }
      const units = value / 100000;
      const total = (units * 1015.29).toFixed(2);
      const increase = (units * 43.71).toFixed(2);
      const city = (units * 528.11).toFixed(2);
      const region = (units * 334.18).toFixed(2);
      const education = (units * 153).toFixed(2);
      out.innerHTML = `On a $${value.toLocaleString('en-CA')} residential assessment, the City’s published 2026 urban rates come to about <strong>$${Number(total).toLocaleString('en-CA')}</strong> in total tax. That is about <strong>$${Number(increase).toLocaleString('en-CA')}</strong> more than 2025: $${Number(city).toLocaleString('en-CA')} City, $${Number(region).toLocaleString('en-CA')} Halton, $${Number(education).toLocaleString('en-CA')} education.`;
    };
    input.addEventListener('input', paint);
    paint();
  }

  const page = document.body.getAttribute('data-authority');
  if (page === 'parking') initParking();
  if (page === 'beach') initBeach();
  if (page === 'go') initGo();
  if (page === 'weekend') initWeekend();
  if (page === 'taxes') initTax();
})();
