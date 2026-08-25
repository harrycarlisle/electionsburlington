(() => {
  const grid = document.querySelector('.camera-grid');
  const cameraStatus = document.getElementById('cameraStatus');
  const trafficEstimate = document.getElementById('trafficEstimate');
  const incidentSummary = document.getElementById('incidentSummary');
  const liveCameras = new Set();
  const SKYWAY = {lat:43.295, lon:-79.79};
  const kmBetween = (a,b,c,d) => {
    const r=6371, toRad=x=>x*Math.PI/180;
    const dLat=toRad(c-a), dLon=toRad(d-b);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(q));
  };
  function tileXY(lat, lon, zoom) {
    const n = 2 ** zoom;
    const x = Math.floor((lon + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return {x, y, zoom};
  }
  function mapMarkup(cam) {
    const tile = tileXY(cam.lat, cam.lon, 13);
    return `<div class="camera-map"><img src="https://tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png" alt="OpenStreetMap location of ${cam.name}" loading="lazy"><span class="camera-pin" aria-hidden="true"><i></i></span></div><p class="camera-map-credit">© OpenStreetMap contributors</p>`;
  }
  function paintStatus() {
    const images = [...document.querySelectorAll('[data-camera]')];
    if (cameraStatus) cameraStatus.textContent = `${liveCameras.size} of ${images.length} cameras live`;
  }
  function bindImages() {
    document.querySelectorAll('[data-camera]').forEach(image => {
      image.addEventListener('load', () => {
        image.closest('.camera-card')?.classList.remove('is-error');
        liveCameras.add(image.dataset.camera);
        paintStatus();
        scheduleVisualEstimate();
      });
      image.addEventListener('error', () => {
        liveCameras.delete(image.dataset.camera);
        image.closest('.camera-card')?.classList.add('is-error');
        paintStatus();
      });
      if (image.complete && image.naturalWidth) {
        liveCameras.add(image.dataset.camera);
        paintStatus();
      }
    });
  }
  async function loadIncidents() {
    if (!incidentSummary) return;
    try {
      const response = await fetch('https://511on.ca/api/v2/get/event?format=json&lang=en', {cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const events = await response.json();
      const nearby = (Array.isArray(events) ? events : []).filter(event => {
        const lat = Number(event.Latitude), lon = Number(event.Longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        const road = String(event.RoadwayName || '').toLowerCase();
        return kmBetween(SKYWAY.lat, SKYWAY.lon, lat, lon) <= 8 && (road.includes('qew') || road.includes('403') || road.includes('skyway') || road.includes('burlington'));
      });
      const serious = nearby.filter(event => event.IsFullClosure || /accident|collision|closure/i.test(`${event.EventType || ''} ${event.EventSubType || ''} ${event.Description || ''}`));
      if (serious.length) incidentSummary.textContent = `Ontario 511 reports ${serious.length} active ${serious.length === 1 ? 'incident' : 'incidents'} near the Burlington Skyway.`;
      else if (nearby.length) incidentSummary.textContent = `Ontario 511 reports ${nearby.length} active road ${nearby.length === 1 ? 'notice' : 'notices'} near the Skyway.`;
      else incidentSummary.textContent = '';
    } catch (_) {
      incidentSummary.textContent = '';
    }
  }
  let visualTimer;
  function scheduleVisualEstimate() {
    clearTimeout(visualTimer);
    visualTimer = setTimeout(runVisualEstimate, 900);
  }
  function frameScore(image) {
    const canvas = document.createElement('canvas');
    const w = 160, h = 90;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, Math.floor(h * .28), w, Math.floor(h * .72)).data;
    let edges = 0, samples = 0, prev = null;
    for (let i = 0; i < data.length; i += 16) {
      const lum = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
      if (prev !== null && Math.abs(lum - prev) > 34) edges++;
      prev = lum; samples++;
    }
    return samples ? edges / samples : 0;
  }
  function runVisualEstimate() {
    const images = [...document.querySelectorAll('[data-camera]')];
    const readable = images.filter(i => liveCameras.has(i.dataset.camera) && i.naturalWidth);
    if (!readable.length) { trafficEstimate.textContent = 'Checking live cameras…'; return; }
    try {
      const scores = readable.map(frameScore);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const label = avg > .34 ? 'heavy' : avg > .25 ? 'moderate' : 'light';
      trafficEstimate.textContent = `Traffic looks ${label}`;
      trafficEstimate.title = 'Experimental visual estimate from current camera frames; not an official traffic-speed measurement.';
    } catch (_) {
      trafficEstimate.textContent = 'Cameras are live';
    }
  }
  function refresh() {
    if (document.hidden) return;
    liveCameras.clear();
    const images = [...document.querySelectorAll('[data-camera]')];
    if (cameraStatus) cameraStatus.textContent = `Refreshing ${images.length} cameras…`;
    images.forEach(image => { image.src = `https://511on.ca/map/Cctv/${image.dataset.camera}?t=${Date.now()}`; });
    loadIncidents();
  }
  fetch('/data/traffic-cameras.json', {cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      if (grid) {
        grid.innerHTML = (data.cameras || []).map(cam => `<figure class="camera-card"><img crossorigin="anonymous" data-camera="${cam.viewId}" src="https://511on.ca/map/Cctv/${cam.viewId}" alt="Live Ontario 511 camera at ${cam.name}, ${cam.detail}"><figcaption class="camera-caption"><strong>${cam.name}</strong><span>${cam.detail} · Ontario 511</span></figcaption><div class="camera-error">This camera is temporarily unavailable.</div>${mapMarkup(cam)}</figure>`).join('');
      }
      bindImages();
      loadIncidents();
      scheduleVisualEstimate();
    })
    .catch(() => {
      bindImages();
      loadIncidents();
      scheduleVisualEstimate();
    });
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
