(() => {
  const KEY = 'burlington-news-explore-v1';
  const LEGACY_V2 = 'burlington-news-food-passport-v2';
  const LEGACY = 'burlington-news-food-passport';
  const RADIUS_M = 220;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const mapsUrl = place => {
    if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
      return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.googleMapsQuery || `${place.placeName} Burlington Ontario`)}`;
  };
  const loadRoot = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  };
  const saveRoot = root => {
    try { localStorage.setItem(KEY, JSON.stringify(root)); }
    catch (_) {}
  };
  function migrateFood() {
    const root = loadRoot();
    root.food = root.food || {};
    try {
      const v2 = JSON.parse(localStorage.getItem(LEGACY_V2) || 'null');
      if (v2 && typeof v2 === 'object') {
        Object.entries(v2).forEach(([id, rec]) => {
          if (root.food[id]) return;
          root.food[id] = {
            status: rec.done ? 'visited' : 'discover',
            rating: rec.rating || 0,
            verified: Boolean(rec.receipt),
            visitedAt: rec.done ? new Date().toISOString() : ''
          };
        });
      }
    } catch (_) {}
    try {
      (JSON.parse(localStorage.getItem(LEGACY) || '[]') || []).forEach(id => {
        root.food[id] = root.food[id] || {status:'visited', rating:0, verified:false, visitedAt:new Date().toISOString()};
      });
    } catch (_) {}
    saveRoot(root);
    return root;
  }
  function haversine(a, b) {
    const toRad = n => n * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon/2)**2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
  function locateOnce() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({lat: pos.coords.latitude, lon: pos.coords.longitude}),
        () => resolve(null),
        {enableHighAccuracy:false, timeout:8000, maximumAge:0}
      );
    });
  }

  function card(place, rec) {
    const status = rec.status || 'discover';
    if (status === 'visited') {
      const stars = [1,2,3,4,5].map(n => `<button type="button" data-food-star="${place.id}" data-star="${n}" class="${(rec.rating||0)>=n?'is-on':''}" aria-label="${n} star">★</button>`).join('');
      return `<article class="food-card is-visited"><small>✓ Visited${rec.verified ? ' · Location confirmed' : ''}</small><h3>${esc(place.displayTitle)}</h3><div class="star-rating">${stars}</div><div class="food-actions"><button type="button" data-food-photo="${esc(place.id)}">Add meal photo</button></div></article>`;
    }
    if (status === 'planned') {
      return `<article class="food-card is-planned"><small>Planned</small><h3>${esc(place.displayTitle)}</h3><p>${esc(place.copy)}</p><div class="food-actions"><a href="${esc(mapsUrl(place))}" target="_blank" rel="noopener">Directions</a><button type="button" data-food-went="${esc(place.id)}">I went</button></div><p class="food-note" data-food-note="${esc(place.id)}" hidden></p></article>`;
    }
    return `<article class="food-card"><small>${esc(place.category)}</small><h3>${esc(place.displayTitle)}</h3><p>${esc(place.copy)}</p><div class="food-actions"><a href="${esc(place.menuUrl)}" target="_blank" rel="noopener">Official menu</a><a href="${esc(mapsUrl(place))}" target="_blank" rel="noopener">Directions</a><button type="button" data-food-want="${esc(place.id)}">Want to go</button></div></article>`;
  }

  async function boot(host) {
    if (!host) return;
    const count = document.getElementById('foodCount');
    const info = document.getElementById('foodWhy');
    const pop = document.getElementById('foodWhyPop');
    let root = migrateFood();
    let places = [];
    try {
      const response = await fetch('/data/food-spots.json', {cache:'no-store'});
      places = (await response.json()).places || [];
    } catch (_) { return; }

    function paint() {
      const visited = places.filter(place => root.food[place.id]?.status === 'visited').length;
      if (count) count.textContent = `${visited} of ${places.length} tried`;
      host.innerHTML = places.map(place => card(place, root.food[place.id] || {status:'discover'})).join('');
    }
    function save() { saveRoot(root); paint(); }

    info?.addEventListener('click', event => {
      event.stopPropagation();
      if (!pop) return;
      pop.hidden = !pop.hidden;
    });
    document.addEventListener('click', () => { if (pop) pop.hidden = true; });

    host.addEventListener('click', async event => {
      const want = event.target.closest('[data-food-want]');
      const went = event.target.closest('[data-food-went]');
      const star = event.target.closest('[data-food-star]');
      const photo = event.target.closest('[data-food-photo]');
      if (photo) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return;
          const id = photo.dataset.foodPhoto;
          root.food[id] = {...(root.food[id]||{}), status:'visited', verified:true, visitedAt: root.food[id]?.visitedAt || new Date().toISOString()};
          save();
        });
        input.click();
        return;
      }
      if (want) {
        root.food[want.dataset.foodWant] = {status:'planned'};
        save();
        return;
      }
      if (star) {
        const id = star.dataset.foodStar;
        root.food[id] = {...(root.food[id]||{}), status:'visited', rating:Number(star.dataset.star), visitedAt: root.food[id]?.visitedAt || new Date().toISOString()};
        save();
        return;
      }
      if (went) {
        const id = went.dataset.foodWent;
        const place = places.find(item => item.id === id);
        const note = host.querySelector(`[data-food-note="${id}"]`);
        const here = await locateOnce();
        if (here && place) {
          const dist = haversine(here, {lat:place.latitude, lon:place.longitude});
          if (dist <= RADIUS_M) {
            root.food[id] = {status:'visited', verified:true, visitedAt:new Date().toISOString(), rating:0};
            save();
            return;
          }
          if (note) {
            note.hidden = false;
            note.innerHTML = `You don't appear to be near this location yet. <button type="button" data-food-anyway="${esc(id)}">Mark visited anyway</button>`;
            return;
          }
        }
        root.food[id] = {status:'visited', verified:false, visitedAt:new Date().toISOString(), rating:0};
        save();
      }
      const anyway = event.target.closest('[data-food-anyway]');
      if (anyway) {
        root.food[anyway.dataset.foodAnyway] = {status:'visited', verified:false, visitedAt:new Date().toISOString(), rating:0};
        save();
      }
    });
    paint();
  }

  window.BurlingtonFoodPassport = {boot};
  const host = document.getElementById('foodGrid');
  if (host) boot(host);
})();
