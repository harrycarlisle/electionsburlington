(() => {
  const host = document.getElementById('communityPulse');
  if (!host) return;
  const esc = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  fetch('data/community-pulse.json',{cache:'no-store'}).then(response => response.ok ? response.json() : Promise.reject()).then(data => {
    const item = data.item;
    const checked = new Date(data.checkedAt || 0);
    if (data.status !== 'available' || !item || !Number.isFinite(checked.getTime()) || Date.now() - checked.getTime() > 6 * 60 * 60 * 1000) return;
    host.innerHTML = `<div><span class="kicker">Community signal</span><h2>Burlington is talking about</h2><p>Public discussion can surface a useful question. It is not proof or polling.</p></div><a href="${esc(item.url)}" target="_blank" rel="noopener"><strong>${esc(item.title)}</strong><span>${Number(item.comments || 0)} public comments · r/BurlingtonON</span></a>`;
    host.hidden = false;
  }).catch(() => {});
})();
