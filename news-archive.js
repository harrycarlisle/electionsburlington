(() => {
  const list = document.querySelector('.latest-list');
  const originals = document.querySelector('.original-grid');
  const search = document.getElementById('newsFilter');
  const chips = document.getElementById('newsChips');
  if (!list) return;
  const cards = [...list.querySelectorAll('.latest-card')];
  let topic = 'all';
  function hay(card) {
    return `${card.dataset.topic || ''} ${card.textContent}`.toLowerCase();
  }
  function paint() {
    const query = (search?.value || '').toLowerCase().trim();
    cards.forEach(card => {
      const matchTopic = topic === 'all' || (card.dataset.topic || '').includes(topic);
      const matchQuery = !query || hay(card).includes(query);
      card.hidden = !(matchTopic && matchQuery);
    });
    if (originals) originals.hidden = topic !== 'all' && topic !== 'originals';
  }
  search?.addEventListener('input', paint);
  chips?.addEventListener('click', event => {
    const button = event.target.closest('[data-topic]');
    if (!button) return;
    topic = button.dataset.topic;
    chips.querySelectorAll('[data-topic]').forEach(node => node.classList.toggle('is-on', node === button));
    paint();
  });
})();
