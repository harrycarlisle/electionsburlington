(() => {
  const DESTINATIONS = [
    {id:'toronto', label:'Toronto'},
    {id:'oakville', label:'Oakville'},
    {id:'hamilton', label:'Hamilton'},
    {id:'stoney-creek', label:'Stoney Creek'},
    {id:'niagara-falls', label:'Niagara Falls'}
  ];
  const live = new Set();
  let cameras = [];
  let surface = null;
  let estimates = {};
  function routeFromLocation() {
    const params = new URLSearchParams(location.search);
    const requested = params.get('route') || params.get('destination') || '';
    if (DESTINATIONS.some(item => item.id === requested)) return requested;
    if (params.get('focus') === 'skyway') return 'hamilton';
    return 'toronto';
  }
  let mode = routeFromLocation();

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const byId = id => document.getElementById(id);

  function tileInfo(lat, lon, zoom) {
    const n = 2 ** zoom;
    const x = (lon + 180) / 360 * n;
    const latRad = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return {
      zoom,
      tileX: Math.floor(x),
      tileY: Math.floor(y),
      left: ((x - Math.floor(x)) * 100).toFixed(2),
      top: ((y - Math.floor(y)) * 100).toFixed(2)
    };
  }

  function mapZoom(cam) {
    return 11;
  }

  function mapUrl(tile) {
    return `https://basemaps.cartocdn.com/light_all/${tile.zoom}/${tile.tileX}/${tile.tileY}.png`;
  }

  function directionClass(direction) {
    const value = String(direction || '').toLowerCase();
    if (value.includes('toronto') || value.includes('east')) return 'is-east';
    if (value.includes('fort erie') || value.includes('west') || value.includes('niagara')) return 'is-west';
    return '';
  }

  function looksFor(cam) {
    const key = String(cam.viewId || cam.cameraId);
    return estimates[key]?.traffic || cam.looks || '';
  }

  function looksLine(cam) {
    const looks = looksFor(cam);
    return looks ? `Traffic looks ${looks}` : '';
  }

  function cameraCard(cam) {
    const zoom = mapZoom(cam);
    const tile = tileInfo(cam.latitude, cam.longitude, zoom);
    const looks = looksLine(cam);
    const dir = directionClass(cam.direction);
    return `<article class="traffic-camera" data-view="${esc(cam.viewId)}">
      <div class="traffic-camera-media">
        <figure class="traffic-camera-shot">
          <img crossorigin="anonymous" data-camera="${esc(cam.viewId)}" src="https://511on.ca/map/Cctv/${esc(cam.viewId)}" alt="Live Ontario 511 camera: ${esc(cam.cameraName)}">
        </figure>
        <div class="traffic-camera-map" aria-hidden="true">
          <img src="${mapUrl(tile)}" alt="">
          <span class="traffic-pin ${dir}" style="left:${tile.left}%;top:${tile.top}%"><i></i></span>
        </div>
      </div>
      <div class="traffic-camera-copy">
        <strong>${esc(cam.cameraName)}</strong>
        <span>${esc(cam.viewName || cam.direction || '')}</span>
        ${looks ? `<em>${esc(looks)}</em>` : ''}
      </div>
    </article>`;
  }

  function unavailableRow(cam) {
    return `<li><strong>${esc(cam.cameraName)}</strong><span>Temporarily unavailable</span></li>`;
  }

  function selectedRoute() {
    return surface?.routes?.[mode] || null;
  }

  function camerasForMode() {
    if (mode === 'all') return cameras.filter(cam => cam.group === 'primary' || cameras.length < 20);
    const route = selectedRoute();
    const ids = new Set((route?.cameras || []).map(item => String(item.viewId || item.cameraId)));
    const matched = cameras.filter(cam => ids.has(String(cam.viewId)) || ids.has(String(cam.cameraId)));
    if (matched.length) return matched;
    return cameras.filter(cam => cam.group === 'primary');
  }

  function renderRoute() {
    const status = byId('routeStatus');
    const based = byId('routeBased');
    const route = selectedRoute();
    if (!status) return;
    if (mode === 'all' || !route) {
      status.innerHTML = `<p class="route-kicker">All cameras</p><h2>Burlington-area cameras</h2><p>Official Ontario 511 views along the QEW, Skyway and nearby interchanges.</p>`;
      if (based) based.innerHTML = '';
      return;
    }
    const incident = (route.incidents || []).find(item => item.type === 'closure' || item.type === 'collision');
    const headline = incident ? 'Delay likely' : (route.status?.headline || 'Check cameras');
    const detail = incident ? incident.title : (route.status?.detail || 'No major incidents detected on this Burlington route.');
    const empty = !incident && !route.status?.looks;
    status.innerHTML = `<p class="route-kicker">${esc(route.label)}</p><h2>${esc(headline)}</h2><p>${esc(empty ? 'No current camera estimate. Live cameras for this route are below.' : detail)}</p>`;
    const bits = (route.cameras || []).map(item => {
      const looks = item.looks || estimates[String(item.viewId)]?.traffic || '';
      const short = String(item.cameraName || '').replace(/^QEW (at|east of|west of) /i, '');
      return looks ? `<span>${esc(short)} · ${esc(looks)}</span>` : '';
    }).filter(Boolean);
    if (based) based.innerHTML = bits.length ? `<small>Based on</small><div>${bits.join('')}</div>` : '';
  }

  function renderCameras() {
    const liveHost = byId('cameraLive');
    const otherHost = byId('cameraOther');
    const otherWrap = byId('cameraOtherWrap');
    const chosen = camerasForMode();
    const available = [];
    const unavailable = [];
    chosen.forEach(cam => {
      const officialDown = String(cam.status || '').toLowerCase() === 'disabled';
      if (officialDown) unavailable.push(cam);
      else available.push(cam);
    });
    live.clear();
    if (liveHost) liveHost.innerHTML = available.map(cameraCard).join('');
    if (otherHost) otherHost.innerHTML = unavailable.map(unavailableRow).join('');
    if (otherWrap) otherWrap.hidden = !unavailable.length;
    bindImages();
    paintStatus();
  }

  function looksUnavailable(image) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      ctx.drawImage(image, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      let yellow = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] > 180 && data[i + 1] > 150 && data[i + 2] < 90) yellow++;
      }
      return yellow > 10;
    } catch (_) {
      return false;
    }
  }

  function paintStatus() {
    const el = byId('cameraStatus');
    const images = [...document.querySelectorAll('#cameraLive [data-camera]')];
    const count = images.filter(image => live.has(image.dataset.camera) && image.naturalWidth).length;
    if (el) el.textContent = images.length ? `${count} of ${images.length} cameras live` : 'Loading cameras';
  }

  function bindImages() {
    document.querySelectorAll('[data-camera]').forEach(image => {
      if (image.dataset.bound) return;
      image.dataset.bound = '1';
      const card = image.closest('.traffic-camera');
      const moveUnavailable = () => {
        live.delete(image.dataset.camera);
        if (!card) return;
        const cam = cameras.find(item => String(item.viewId) === String(image.dataset.camera));
        card.remove();
        const otherHost = byId('cameraOther');
        const otherWrap = byId('cameraOtherWrap');
        if (cam && otherHost && !otherHost.querySelector(`[data-missing="${cam.viewId}"]`)) {
          otherHost.insertAdjacentHTML('beforeend', `<li data-missing="${esc(cam.viewId)}"><strong>${esc(cam.cameraName)}</strong><span>Temporarily unavailable</span></li>`);
        }
        if (otherWrap) otherWrap.hidden = !otherHost?.children.length;
        paintStatus();
      };
      image.addEventListener('load', () => {
        if (!image.naturalWidth || looksUnavailable(image)) return moveUnavailable();
        live.add(image.dataset.camera);
        paintStatus();
      });
      image.addEventListener('error', moveUnavailable);
      if (image.complete) {
        if (image.naturalWidth && !looksUnavailable(image)) live.add(image.dataset.camera);
        else moveUnavailable();
        paintStatus();
      }
    });
  }

  function renderChips() {
    const host = byId('routeChips');
    if (!host) return;
    host.innerHTML = DESTINATIONS.map(item => `<button type="button" data-route="${item.id}"${item.id === mode ? ' aria-pressed="true"' : ''}>${esc(item.label)}</button>`).join('') +
      `<button type="button" class="is-quiet" data-route="all"${mode === 'all' ? ' aria-pressed="true"' : ''}>View all cameras</button>`;
    host.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        mode = button.dataset.route;
        const next = new URL(location.href);
        if (mode === 'all') next.searchParams.delete('route');
        else next.searchParams.set('route', mode);
        history.replaceState(null, '', next);
        renderChips();
        renderRoute();
        renderCameras();
      });
    });
  }

  function refresh() {
    if (document.hidden) return;
    live.clear();
    document.querySelectorAll('[data-camera]').forEach(image => {
      image.src = `https://511on.ca/map/Cctv/${image.dataset.camera}?t=${Date.now()}`;
    });
  }

  function applyEstimates(data) {
    estimates = {};
    (data?.cameras || []).forEach(item => {
      estimates[String(item.viewId || item.cameraId)] = item;
    });
    (cameras).forEach(cam => {
      cam.looks = estimates[String(cam.viewId)]?.traffic || estimates[String(cam.cameraId)]?.traffic || cam.looks || '';
    });
  }

  Promise.allSettled([
    fetch('/data/traffic-cameras.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
    fetch('/data/traffic-surface.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null),
    fetch('/data/traffic-estimates.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null)
  ]).then(results => {
    cameras = results[0].status === 'fulfilled' && results[0].value ? (results[0].value.cameras || []) : [];
    surface = results[1].status === 'fulfilled' ? results[1].value : null;
    applyEstimates(results[2].status === 'fulfilled' ? results[2].value : null);
    renderChips();
    renderRoute();
    renderCameras();
  });

  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
