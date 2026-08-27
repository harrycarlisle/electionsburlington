(() => {
  const host = document.getElementById('localNow');
  const header = document.getElementById('headerLive');
  if (!host || !header) return;

  const ROTATE_MS = 2300;
  const REFRESH_MS = 60000;
  const ROUTES = ['toronto', 'oakville', 'hamilton', 'stoney-creek', 'niagara-falls'];
  const ROUTE_LABELS = {toronto:'Toronto', oakville:'Oakville', hamilton:'Hamilton', 'stoney-creek':'Stoney Creek', 'niagara-falls':'Niagara'};
  let cards = [];
  let index = 0;
  let timer = 0;
  let painting = false;

  const shortPlace = value => String(value || '')
    .replace(/\s+(Drive|Rd|Road|Avenue|Ave|Street|St|Boulevard|Blvd|Line)\.?$/i, '')
    .replace(/\s+/g, ' ').trim();

  function roadName(value) {
    const match = /\b(QEW|(?:Highway|HWY)\s*403|403|407|401)\b/i.exec(String(value || ''));
    if (!match) return 'QEW';
    return /403/i.test(match[1]) ? '403' : match[1].toUpperCase().replace('HIGHWAY ', '').replace('HWY ', '');
  }

  function routeFromIncident(item) {
    const text = `${item?.direction || ''} ${item?.impact || ''} ${item?.title || ''}`;
    if (/toronto|eastbound/i.test(text)) return 'toronto';
    if (/fort erie|niagara/i.test(text)) return 'niagara-falls';
    if (/hamilton|westbound/i.test(text)) return 'hamilton';
    return 'toronto';
  }

  function delayMinutes(item) {
    const direct = Number(item?.delayMinutes || item?.delay || item?.minutes || item?.status?.delayMinutes);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
    const text = `${item?.impact || ''} ${item?.title || ''} ${item?.rawHeadline || ''}`;
    const match = text.match(/\+(\d{1,2})\s*min/i) || text.match(/\b(\d{1,2})\s*minutes?\b/i);
    return match ? Number(match[1]) : null;
  }

  function cameraLooks(route, estimates) {
    const cams = Array.isArray(route?.cameras) ? route.cameras : [];
    const values = cams.map(cam => {
      const estimate = estimates.get(String(cam.viewId || cam.cameraId));
      return String(estimate?.traffic || cam.looks || '').toLowerCase();
    }).filter(Boolean);
    if (!values.length) return null;
    const counts = values.reduce((out, value) => {
      const key = /heavy/.test(value) ? 'Heavy' : (/moderate|slow/.test(value) ? 'Slow' : (/clear|light/.test(value) ? 'Clear' : ''));
      if (key) out[key] = (out[key] || 0) + 1;
      return out;
    }, {});
    if ((counts.Heavy || 0) >= 2) return 'Heavy';
    if ((counts.Slow || 0) >= 2 || counts.Heavy) return 'Slow';
    if (counts.Clear) return 'Clear';
    return null;
  }

  function incidentScore(item) {
    const text = `${item?.title || ''} ${item?.rawHeadline || ''}`;
    const municipality = String(item?.municipality || '');
    let score = 0;
    if (/burlington/i.test(municipality)) score += 60;
    else if (/oakville|halton/i.test(municipality)) score += 45;
    else if (/mississauga|hamilton/i.test(municipality)) score += 28;
    if (item?.type === 'collision') score += 55;
    if (item?.type === 'closure' && !/ramp/i.test(`${item?.facility || ''} ${text}`)) score += 50;
    if (item?.type === 'closure' && /ramp/i.test(`${item?.facility || ''} ${text}`)) score += 18;
    if (/all lanes closed|completely closed|fully closed/i.test(text)) score += 20;
    if (/qew|403|skyway/i.test(`${item?.roadway || ''} ${text}`)) score += 20;
    return score;
  }

  function incidentCard(item) {
    const routeId = routeFromIncident(item);
    const destination = ROUTE_LABELS[routeId];
    const road = roadName(`${item?.roadway || ''} ${item?.title || ''}`);
    const place = shortPlace(item?.nearestRoad || item?.municipality || '');
    const ramp = /ramp/i.test(`${item?.facility || ''} ${item?.title || ''}`);
    const collision = item?.type === 'collision' || /collision|crash/i.test(item?.title || '');
    const closed = item?.type === 'closure' || /closed/i.test(item?.title || '');
    const minutes = delayMinutes(item);
    let detail = collision ? 'Collision' : (closed ? (ramp ? 'Ramp closed' : 'Closure') : 'Traffic issue');
    if (place) detail += ` near ${place}`;
    return {
      key:`incident:${item?.id || item?.title}`,
      score:incidentScore(item),
      title:`${road} → ${destination}`,
      detail,
      metric:minutes ? `+${minutes} min` : (closed && !ramp ? 'Closed' : (collision ? 'Heavy' : (ramp ? 'Watch' : 'Slow'))),
      url:`/traffic/?destination=${routeId}`
    };
  }

  function routeCard(routeId, route, estimates) {
    const status = String(route?.status?.looks || route?.status?.level || '').toLowerCase();
    const camera = cameraLooks(route, estimates);
    const condition = camera || (/heavy/.test(status) ? 'Heavy' : (/moderate|slow|delay/.test(status) ? 'Slow' : (/clear|light/.test(status) ? 'Clear' : '')));
    const destination = ROUTE_LABELS[routeId];
    const cameras = Array.isArray(route?.cameras) ? route.cameras : [];
    const useful = cameras.find(cam => cameraLooks({cameras:[cam]}, estimates) === condition) || cameras[Math.floor(cameras.length / 2)] || cameras[0];
    const place = shortPlace(useful?.cameraName || useful?.viewName || '').replace(/^QEW\s+(?:East|West)?\s*(?:of|at)\s+/i, '');
    const detail = condition === 'Heavy' ? `Heavy${place ? ` near ${place}` : ''}`
      : condition === 'Slow' ? `Slow${place ? ` near ${place}` : ''}`
      : condition === 'Clear' ? 'Moving well' : 'Live cameras available';
    return {
      key:`route:${routeId}`,
      score:(routeId === 'toronto' ? 44 : routeId === 'hamilton' ? 34 : routeId === 'oakville' ? 30 : 22) + (condition === 'Heavy' ? 35 : condition === 'Slow' ? 20 : 0),
      title:`QEW → ${destination}`,
      detail,
      metric:condition || 'Live',
      url:`/traffic/?destination=${routeId}`
    };
  }

  function intelCards(intel) {
    return (Array.isArray(intel?.signals) ? intel.signals : [])
      .filter(signal => signal?.kind === 'traffic' && Number(signal?.score) >= 90)
      .filter(signal => /burlington|oakville|halton|mississauga|hamilton|qew|403|skyway/i.test(`${signal?.neighbourhood || ''} ${signal?.location || ''} ${signal?.headline || ''}`))
      .map(signal => {
        const item = {
          id:`intel:${signal.id}`,
          title:signal.headline,
          rawHeadline:signal.headline,
          roadway:signal.location,
          direction:signal.direction,
          municipality:signal.neighbourhood,
          nearestRoad:signal.location,
          type:/collision|crash/i.test(signal.headline || '') ? 'collision' : (/clos/i.test(signal.headline || '') ? 'closure' : 'incident'),
          facility:/ramp/i.test(signal.headline || '') ? 'ramp' : 'mainline'
        };
        const card = incidentCard(item);
        card.score = Math.max(card.score, Number(signal.score));
        return card;
      });
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter(item => {
      const signature = `${item.title}|${item.detail}`.toLowerCase();
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function buildCards(surface, estimateDoc, intel) {
    const estimates = new Map((estimateDoc?.cameras || []).map(item => [String(item.viewId || item.cameraId), item]));
    const incidents = (Array.isArray(surface?.incidents) ? surface.incidents : [])
      .filter(item => /burlington|oakville|halton|mississauga|hamilton/i.test(item?.municipality || '') || /qew|403|skyway/i.test(`${item?.roadway || ''} ${item?.title || ''}`))
      .map(incidentCard);
    const routes = ROUTES
      .filter(routeId => surface?.routes?.[routeId])
      .map(routeId => routeCard(routeId, surface.routes[routeId], estimates));
    const ranked = dedupe([...incidents, ...intelCards(intel), ...routes]).sort((a,b) => b.score - a.score);
    const major = ranked.filter(item => item.score >= 70).slice(0, 2);
    const commute = ranked.find(item => item.key === 'route:toronto') || ranked.find(item => item.key.startsWith('route:'));
    const opposite = ranked.find(item => item.key === 'route:hamilton' || item.key === 'route:niagara-falls');
    return dedupe([...major, commute, opposite].filter(Boolean)).slice(0, 3);
  }

  function drivingActive() {
    return host.querySelector('[data-mode="driving"].is-active, [data-mode="driving"][aria-current="true"]');
  }

  function panel() {
    return header.querySelector('.now-panel') || host.querySelector('.now-panel');
  }

  function paint() {
    if (painting || !cards.length || !drivingActive()) return;
    const root = panel();
    const card = root?.querySelector('.now-card-driving');
    if (!card) return;
    const model = cards[index % cards.length];
    painting = true;
    try {
      const title = card.querySelector('.now-card-copy strong');
      const detail = card.querySelector('.now-card-copy em');
      const metric = card.querySelector('.now-card-metric');
      if (title) title.textContent = model.title;
      if (detail) detail.textContent = model.detail;
      if (metric) metric.textContent = model.metric;
      card.href = model.url;
      card.dataset.trafficRotation = String(index % cards.length);
      card.classList.toggle('is-alert', model.score >= 70);
    } finally {
      painting = false;
    }
  }

  function startRotation() {
    if (timer) clearInterval(timer);
    timer = window.setInterval(() => {
      if (document.hidden || !drivingActive() || cards.length < 2) return;
      index = (index + 1) % cards.length;
      paint();
    }, ROTATE_MS);
  }

  async function load() {
    try {
      const [surface, estimates, intel] = await Promise.all([
        fetch('/data/traffic-surface.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
        fetch('/data/traffic-estimates.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
        fetch('/data/local-intelligence.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null)
      ]);
      const next = buildCards(surface, estimates, intel);
      if (next.length) {
        cards = next;
        index = 0;
        paint();
        startRotation();
      }
    } catch (_) {}
  }

  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:720px){
      body.home-page .header-live .now-card-driving{padding-right:40px!important;gap:8px!important}
      body.home-page .header-live .now-card-driving .now-card-copy{min-width:0!important;flex:1 1 auto!important}
      body.home-page .header-live .now-card-driving .now-card-copy strong{font-size:13px!important;line-height:1.08!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      body.home-page .header-live .now-card-driving .now-card-copy em{font-size:10.5px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      body.home-page .header-live .now-card-driving .now-card-metric{flex:0 0 auto!important;max-width:82px!important;font-size:10px!important;line-height:1!important;padding:4px 7px!important;white-space:nowrap!important}
      body.home-page .header-live .now-card-driving+.now-next{right:3px!important;width:34px!important;height:34px!important}
      body.home-page .header-live .now-card-driving+.now-next .now-next-disc{width:27px!important;height:27px!important}
    }`;
  document.head.appendChild(style);

  const observer = new MutationObserver(() => {
    if (!painting) requestAnimationFrame(paint);
  });
  observer.observe(host, {subtree:true, childList:true, attributes:true, attributeFilter:['class','aria-current']});
  observer.observe(header, {subtree:true, childList:true});

  load();
  setInterval(load, REFRESH_MS);
})();