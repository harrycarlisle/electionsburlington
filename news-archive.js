(() => {
  const grid = document.getElementById('newsGrid');
  const search = document.getElementById('newsFilter');
  const select = document.getElementById('newsTopic');
  const more = document.getElementById('showMore');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.news-card')];
  const INITIAL_DESKTOP = 9;
  const INITIAL_MOBILE = 6;
  let expanded = false;

  const isMobile = () => matchMedia('(max-width:760px)').matches;
  const hay = card => `${card.dataset.topic || ''} ${card.textContent || ''}`.toLowerCase();

  function filteredCards() {
    const query = (search?.value || '').trim().toLowerCase();
    const topic = select?.value || 'all';
    return cards.filter(card => {
      const matchesTopic = topic === 'all' || (card.dataset.topic || '').split(/\s+/).includes(topic);
      const matchesQuery = !query || hay(card).includes(query);
      return matchesTopic && matchesQuery;
    });
  }

  function paint() {
    const matches = filteredCards();
    const limit = expanded ? Infinity : (isMobile() ? INITIAL_MOBILE : INITIAL_DESKTOP);
    const allowed = new Set(matches.slice(0, limit));
    cards.forEach(card => { card.hidden = !allowed.has(card); });

    let empty = grid.querySelector('.news-empty');
    if (!matches.length) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'news-empty';
        empty.textContent = 'No Burlington News stories match that search yet.';
        grid.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }

    if (more) {
      const needsMore = matches.length > (isMobile() ? INITIAL_MOBILE : INITIAL_DESKTOP);
      more.hidden = !needsMore;
      more.textContent = expanded ? 'Show less' : 'Show more';
      more.setAttribute('aria-expanded', String(expanded));
    }
  }

  search?.addEventListener('input', () => { expanded = false; paint(); });
  select?.addEventListener('change', () => { expanded = false; paint(); });
  more?.addEventListener('click', () => { expanded = !expanded; paint(); });
  addEventListener('resize', paint, {passive:true});
  paint();
})();
