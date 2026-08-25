(() => {
  const list = document.getElementById('latestList');
  const originals = document.getElementById('originalGrid');
  const search = document.getElementById('newsFilter');
  const topicSelect = document.getElementById('newsTopic');
  const moreNews = document.getElementById('showMoreNews');
  const moreOriginals = document.getElementById('showMoreOriginals');
  if (!list) return;
  const cards = [...list.querySelectorAll('.latest-card')];
  const originalCards = originals ? [...originals.querySelectorAll('.original-card')] : [];
  const PAGE = 8;
  const ORIGINAL_PAGE = 3;
  let shown = PAGE;
  let originalsShown = ORIGINAL_PAGE;
  let topic = 'all';

  function hay(node) {
    return `${node.dataset.topic || ''} ${node.textContent}`.toLowerCase();
  }

  function paint() {
    const query = (search?.value || '').toLowerCase().trim();
    let visibleCount = 0;
    cards.forEach(card => {
      const matchTopic = topic === 'all' || (card.dataset.topic || '').includes(topic);
      const matchQuery = !query || hay(card).includes(query);
      const match = matchTopic && matchQuery;
      if (!match) {
        card.hidden = true;
        card.classList.remove('is-collapsed');
        return;
      }
      visibleCount += 1;
      const collapse = visibleCount > shown;
      card.hidden = false;
      card.classList.toggle('is-collapsed', collapse);
    });
    if (moreNews) moreNews.hidden = visibleCount <= shown;
    if (originals) {
      const showOriginals = topic === 'all' || topic === 'originals';
      originals.hidden = !showOriginals;
      if (moreOriginals) moreOriginals.parentElement.hidden = !showOriginals;
      if (showOriginals) {
        originalCards.forEach((card, index) => {
          const matchQuery = !query || hay(card).includes(query);
          card.hidden = !matchQuery;
          card.classList.toggle('is-collapsed', matchQuery && index >= originalsShown);
        });
        const remaining = originalCards.filter((card, index) => !card.hidden && index >= originalsShown).length;
        if (moreOriginals) moreOriginals.hidden = remaining === 0;
      }
    }
  }

  search?.addEventListener('input', paint);
  topicSelect?.addEventListener('change', () => {
    topic = topicSelect.value;
    shown = PAGE;
    paint();
  });
  moreNews?.addEventListener('click', () => {
    shown += PAGE;
    paint();
  });
  moreOriginals?.addEventListener('click', () => {
    originalsShown += ORIGINAL_PAGE;
    paint();
  });
  paint();
})();
