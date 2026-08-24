(() => {
  const cards = [
    {id:'corned-beef-hut',tag:'Food',filters:['food'],icon:'01',title:'Order the sandwich Burlington keeps talking about.',copy:'Corned Beef Hut is the first stop in the Burlington News food guide. The deeper challenge: notice what makes a one-item specialty place survive.',url:'guides/best-of-burlington.html#corned-beef-hut'},
    {id:'freeman-station',tag:'History · Free',filters:['free','history'],icon:'02',title:'Find Burlington’s rescued railway station.',copy:'Freeman Station is the surviving Grand Trunk Railway station moved from the rail corridor and restored by local volunteers.',url:'https://freemanstation.ca/'},
    {id:'lift-bridge',tag:'Engineering · Free',filters:['free','history','outdoors'],icon:'03',title:'Time your walk for a ship.',copy:'Check marine traffic, walk to the canal and try to arrive when the Burlington Canal Lift Bridge has to clear the channel.',url:'https://tc.canada.ca/en/ontario-region/burlington-canal-lift-bridge'},
    {id:'bird-migration',tag:'Wildlife · Free',filters:['free','outdoors'],icon:'04',title:'Stand under a migration route most people never notice.',copy:'Use RBG’s long-running bird monitoring as your field guide, then look up: western Lake Ontario concentrates seasonal migration.',url:'https://www.rbg.ca/app/uploads/Long-Watch-Birds-2015-2024-Summary-Report.pdf?x51525='},
    {id:'joseph-brant',tag:'History',filters:['history'],icon:'05',title:'Look for the house hidden inside a museum.',copy:'Joseph Brant Museum is built around a reconstruction of the homestead associated with Joseph Brant and a much larger Burlington story.',url:'https://museumsofburlington.ca/joseph-brant-museum/'},
    {id:'mount-nemo',tag:'Outside',filters:['outdoors'],icon:'06',title:'Stand at the edge of an ancient inland sea.',copy:'Mount Nemo’s cliffs expose Niagara Escarpment geology. The view is the payoff; the rock beneath it is the actual story.',url:'https://www.conservationhalton.ca/parks/mount-nemo/'},
    {id:'public-art',tag:'Art · Free',filters:['free','history'],icon:'07',title:'Build a scavenger hunt from Burlington’s public art map.',copy:'Pick three works you have passed without noticing. Do not reveal the final one to the person coming with you.',url:'https://www.burlington.ca/en/arts-culture-and-events/public-art.aspx'},
    {id:'kerncliff',tag:'Outside · Free',filters:['free','outdoors'],icon:'08',title:'Walk through a quarry that became a wetland.',copy:'Kerncliff Park turns an old quarry landscape into boardwalks, forest and escarpment habitat.',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/kerncliff-park.aspx'},
    {id:'beachway',tag:'Outside · Free',filters:['free','outdoors'],icon:'09',title:'Walk Burlington’s strip between lake and highway.',copy:'Beachway Park compresses beach, dunes, the canal, the Skyway and transportation history into one unusual shoreline.',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/beachway-park.aspx'},
    {id:'fishway',tag:'Wildlife · Free',filters:['free','outdoors'],icon:'10',title:'Follow the fish story upstream.',copy:'Read the latest Fishway count, then visit the Cootes Paradise area knowing why carp, oxygen and one narrow passage matter.',url:'articles/fishway-26000-fish.html'},
    {id:'waterfront',tag:'Outside · Free',filters:['free','outdoors'],icon:'11',title:'Keep walking after everybody stops at the pier.',copy:'Start at Spencer Smith Park, pass the obvious photo spot and follow the quieter change in Burlington’s shoreline.',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/spencer-smith-park.aspx'},
    {id:'ireland-house',tag:'History',filters:['history'],icon:'12',title:'Enter Burlington before it looked like Burlington.',copy:'Ireland House preserves a family home and farm landscape that predates the suburban city around it.',url:'https://museumsofburlington.ca/ireland-house-museum/'}
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const card = document.getElementById('deckCard');
  const list = document.getElementById('exploreList');
  const count = document.getElementById('passportCount');
  const progress = document.getElementById('passportProgress');
  const map = document.getElementById('passportMap');
  const storageKey = 'burlington-news-passport';
  let completed = new Set();
  let filter = 'all';
  let last = -1;
  try { completed = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch (_) {}
  document.getElementById('deckFilters')?.insertAdjacentHTML('beforeend','<button class="deck-filter" aria-pressed="false" data-filter="food">Food</button>');
  function paintProgress() {
    count.textContent = `${completed.size} of ${cards.length} explored`;
    progress.style.width = `${completed.size / cards.length * 100}%`;
    map.innerHTML = cards.map(item => `<i class="${completed.has(item.id) ? 'done' : ''}"></i>`).join('');
    try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch (_) {}
  }
  function toggleDone(id) {
    if (completed.has(id)) completed.delete(id); else completed.add(id);
    paintProgress();
    paint(last);
  }
  function paint(index) {
    const item = cards[index];
    const done = completed.has(item.id);
    card.innerHTML = `<div class="deck-visual" aria-hidden="true">${item.icon}</div><div class="deck-copy"><span class="deck-tag">${esc(item.tag)}</span><h2>${esc(item.title)}</h2><p>${esc(item.copy)}</p><div class="deck-actions"><a href="${esc(item.url)}">Reveal the place →</a><button class="done-button ${done ? 'done' : ''}" type="button">${done ? 'Explored ✓' : 'Mark explored'}</button></div></div>`;
    card.querySelector('.done-button').addEventListener('click', () => toggleDone(item.id));
    last = index;
  }
  function shuffle() {
    const eligible = cards.map((item,index) => ({item,index})).filter(entry => filter === 'all' || entry.item.filters.includes(filter));
    const unseen = eligible.filter(entry => entry.index !== last && !completed.has(entry.item.id));
    const alternatives = unseen.length ? unseen : eligible.filter(entry => entry.index !== last);
    const choices = alternatives.length ? alternatives : eligible;
    paint(choices[Math.floor(Math.random() * choices.length)].index);
  }
  document.querySelectorAll('.deck-filter').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.deck-filter').forEach(item => item.setAttribute('aria-pressed', item === button ? 'true' : 'false'));
    shuffle();
  }));
  document.getElementById('shuffleButton')?.addEventListener('click', shuffle);
  list.innerHTML = cards.map(item => `<article class="explore-row"><div class="explore-row-icon" aria-hidden="true">${item.icon}</div><div><small>${esc(item.tag)}</small><strong>${esc(item.title)}</strong><p>${esc(item.copy)}</p></div><a href="${esc(item.url)}">Details →</a></article>`).join('');
  paintProgress();
  shuffle();
})();
