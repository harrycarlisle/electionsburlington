(() => {
  const headlineById = {
    'burlington-flood-protection-90-million': 'Burlington spent more than $90 million on stormwater upgrades. Did it work?',
    'costco-burloak-wyecroft': 'Oakville approved a new Costco near Burloak. How will drivers get in?'
  };

  function apply() {
    document.querySelectorAll('[data-story-id]').forEach(card => {
      const title = headlineById[card.dataset.storyId];
      if (!title) return;
      const target = card.querySelector('strong,h1,h2,h3');
      if (target) target.textContent = title;
    });
    const picks = document.getElementById('pickGrid');
    if (picks) [...picks.children].slice(2).forEach(node => node.remove());
  }

  const observer = new MutationObserver(apply);
  const latest = document.getElementById('latestList');
  const picks = document.getElementById('pickGrid');
  if (latest) observer.observe(latest, {childList:true, subtree:true});
  if (picks) observer.observe(picks, {childList:true, subtree:true});
  apply();
})();
