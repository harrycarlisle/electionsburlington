(() => {
  const headlineById = {
    'burlington-flood-protection-90-million': 'Burlington spent more than $90 million on stormwater upgrades. Did it work?',
    'costco-burloak-wyecroft': 'Oakville approved a new Costco near Burloak. How will drivers get in?'
  };
  const liveHeadlineByPath = {
    '/stories/burlington-flood-protection-90-million/': 'Did Burlington’s $90 million in stormwater upgrades work?',
    '/stories/costco-burloak-wyecroft/': 'New Costco near Burloak: how will drivers get in?'
  };

  function apply() {
    document.querySelectorAll('[data-story-id]').forEach(card => {
      const title = headlineById[card.dataset.storyId];
      if (!title) return;
      const target = card.querySelector('strong,h1,h2,h3');
      if (target) target.textContent = title;
    });
    document.querySelectorAll('#breakingNow .breaking-row').forEach(row => {
      const title = liveHeadlineByPath[row.getAttribute('href')];
      const target = row.querySelector('strong');
      if (title && target) target.textContent = title;
    });
    const picks = document.getElementById('pickGrid');
    if (picks) [...picks.children].slice(2).forEach(node => node.remove());
  }

  const observer = new MutationObserver(apply);
  ['latestList','pickGrid','breakingNow'].forEach(id => {
    const node = document.getElementById(id);
    if (node) observer.observe(node, {childList:true, subtree:true});
  });
  apply();
})();
