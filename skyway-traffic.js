(() => {
  const images = [...document.querySelectorAll('[data-camera]')];
  const status = document.getElementById('cameraStatus');
  const routeList = document.getElementById('routeList');
  const useLocation = document.getElementById('useLocation');
  const locationNote = document.getElementById('locationNote');
  let origin = 'Burlington, Ontario';
  const liveCameras = new Set();

  const routeUrl = destination => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  const paintRoutes = () => routeList?.querySelectorAll('[data-destination]').forEach(link => {
    link.href = routeUrl(link.dataset.destination);
    link.target = '_blank';
    link.rel = 'noopener';
  });
  const markLoaded = image => {
    image.closest('.camera-card')?.classList.remove('is-error');
    liveCameras.add(image.dataset.camera);
    if (status) status.textContent = `${liveCameras.size} of ${images.length} cameras live`;
  };
  const markError = image => {
    liveCameras.delete(image.dataset.camera);
    image.closest('.camera-card')?.classList.add('is-error');
    if (status) status.textContent = `${liveCameras.size} of ${images.length} cameras live`;
  };
  images.forEach(image => {
    image.addEventListener('load', () => markLoaded(image));
    image.addEventListener('error', () => markError(image));
    if (image.complete && image.naturalWidth) markLoaded(image);
  });
  const refresh = () => {
    if (document.hidden) return;
    liveCameras.clear();
    if (status) status.textContent = `Refreshing ${images.length} cameras…`;
    images.forEach(image => { image.src = `https://511on.ca/map/Cctv/${image.dataset.camera}?t=${Date.now()}`; });
  };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  useLocation?.addEventListener('click', () => {
    if (!navigator.geolocation) { locationNote.textContent = 'Location isn’t available in this browser.'; return; }
    useLocation.disabled = true;
    locationNote.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(position => {
      origin = `${position.coords.latitude},${position.coords.longitude}`;
      paintRoutes();
      locationNote.textContent = 'Routes now start from your current location. It isn’t stored.';
      useLocation.textContent = 'Current location is on';
    }, () => {
      locationNote.textContent = 'Location wasn’t shared. Routes still start in Burlington.';
      useLocation.disabled = false;
    }, {enableHighAccuracy:false, timeout:8000, maximumAge:300000});
  });
  paintRoutes();
})();
