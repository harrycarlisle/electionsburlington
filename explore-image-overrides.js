(() => {
  const month = Number(new Intl.DateTimeFormat('en-CA',{month:'numeric',timeZone:'America/Toronto'}).format(new Date()));
  const imageForTitle = title => {
    const key = String(title || '').toLowerCase();
    if (/elizabeth gardens art walk|art walk/.test(key)) return '/assets/art-walk.png';
    if (/farmers.?market/.test(key)) return month >= 9 ? '/assets/farmers-market-fall.png' : '/assets/farmers-market-summer.png';
    if (/bbcc|bums regatta|f18 championship|sail/.test(key)) return '/assets/Four%20Sailboats%20on%20a%20Choppy%20Lake%20-bbc-bums.png';
    if (/asian night|asian market|night market/.test(key)) return '/assets/asian-food-night.png';
    return '';
  };
  const altForTitle = title => {
    const key = String(title || '').toLowerCase();
    if (/art walk/.test(key)) return 'Visitors at an outdoor community art event.';
    if (/farmers.?market/.test(key)) return 'Fresh produce at an outdoor farmers market.';
    if (/bbcc|bums regatta|f18 championship|sail/.test(key)) return 'Sailboats racing on Lake Ontario.';
    if (/asian night|asian market|night market/.test(key)) return 'Food stalls and visitors at an evening Asian food market.';
    return title || 'Explore Burlington event';
  };

  function apply(root = document) {
    root.querySelectorAll?.('.event-card').forEach(card => {
      const title = card.querySelector('h3')?.textContent?.trim() || '';
      const src = imageForTitle(title);
      const img = card.querySelector('.event-visual img');
      if (src && img && img.getAttribute('src') !== src) {
        img.src = src;
        img.alt = altForTitle(title);
        img.onerror = () => { img.onerror = null; img.src = '/assets/editorial/explore-collage.webp'; };
      }
    });

    const dialog = root.querySelector?.('#dialogContent');
    if (dialog) {
      const title = dialog.querySelector('h2')?.textContent?.trim() || '';
      const src = imageForTitle(title);
      const img = dialog.querySelector('.dialog-visual img');
      if (src && img && img.getAttribute('src') !== src) {
        img.src = src;
        img.alt = altForTitle(title);
        img.onerror = () => { img.onerror = null; img.src = '/assets/editorial/explore-collage.webp'; };
      }
    }
  }

  const observer = new MutationObserver(() => apply(document));
  const start = () => {
    apply(document);
    const eventGrid = document.getElementById('eventGrid');
    const dialogContent = document.getElementById('dialogContent');
    if (eventGrid) observer.observe(eventGrid,{childList:true,subtree:true});
    if (dialogContent) observer.observe(dialogContent,{childList:true,subtree:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
