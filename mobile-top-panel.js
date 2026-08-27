(() => {
  const mq = window.matchMedia('(max-width: 720px)');
  const host = document.getElementById('localNow');
  const slot = document.getElementById('headerLive');
  if (!host || !slot) return;

  let moving = false;

  function sync() {
    if (moving) return;
    moving = true;
    try {
      if (mq.matches) {
        const panel = host.querySelector('.now-panel');
        if (panel) {
          slot.innerHTML = '';
          slot.appendChild(panel);
          slot.hidden = false;
          host.classList.add('is-header-card');
        } else if (!slot.querySelector('.now-panel')) {
          slot.hidden = true;
        }
      } else {
        const panel = slot.querySelector('.now-panel');
        if (panel) {
          const dots = host.querySelector('.now-dots');
          if (dots) host.insertBefore(panel, dots);
          else host.prepend(panel);
        }
        slot.hidden = true;
        host.classList.remove('is-header-card');
      }
    } finally {
      moving = false;
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(host, {childList:true, subtree:false});
  observer.observe(slot, {childList:true, subtree:false});
  mq.addEventListener?.('change', sync);
  window.addEventListener('resize', sync, {passive:true});

  sync();
  requestAnimationFrame(sync);
  setTimeout(sync, 0);
  setTimeout(sync, 250);
})();
