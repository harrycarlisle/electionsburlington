(() => {
  const cards = [
    {id:'corned-beef-hut',tag:'Food',filters:['food'],icon:'01',title:'Try the sandwich Corned Beef Hut is known for.',copy:'Start with the corned beef sandwich that gives the place its name.',image:'assets/editorial/explore-collage.webp',position:'22% 52%',url:'guides/best-of-burlington.html#corned-beef-hut'},
    {id:'freeman-station',tag:'History · Free',filters:['free','history'],icon:'02',title:'Find Burlington’s rescued railway station.',copy:'Volunteers moved and restored this surviving Grand Trunk station.',image:'assets/editorial/explore-collage.webp',position:'76% 46%',url:'https://freemanstation.ca/'},
    {id:'lift-bridge',tag:'Engineering · Free',filters:['free','history','outdoors'],icon:'03',title:'Time your walk for a ship.',copy:'Walk to the canal when the lift bridge has to clear the channel.',image:'assets/home/skyway.webp',position:'63% 50%',url:'https://tc.canada.ca/en/ontario-region/burlington-canal-lift-bridge'},
    {id:'bird-migration',tag:'Wildlife · Free',filters:['free','outdoors'],icon:'04',title:'Stand under a migration route.',copy:'Western Lake Ontario funnels seasonal bird migration overhead.',image:'assets/editorial/explore-collage.webp',position:'52% 18%',url:'https://www.rbg.ca/app/uploads/Long-Watch-Birds-2015-2024-Summary-Report.pdf?x51525='},
    {id:'joseph-brant',tag:'History',filters:['history'],icon:'05',title:'Look for the house inside the museum.',copy:'The museum is built around a reconstruction of Joseph Brant’s homestead.',image:'assets/editorial/explore-collage.webp',position:'77% 24%',url:'https://museumsofburlington.ca/joseph-brant-museum/'},
    {id:'mount-nemo',tag:'Outside',filters:['outdoors'],icon:'06',title:'Stand at the edge of an ancient sea.',copy:'The view is the payoff. The escarpment rock is the story.',image:'assets/editorial/explore-collage.webp',position:'22% 22%',url:'https://www.conservationhalton.ca/parks/mount-nemo/'},
    {id:'public-art',tag:'Art · Free',filters:['free','history'],icon:'07',title:'Turn public art into a scavenger hunt.',copy:'Pick three pieces you’ve walked past without noticing.',image:'assets/editorial/explore-collage.webp',position:'50% 73%',url:'https://www.burlington.ca/en/arts-culture-and-events/public-art.aspx'},
    {id:'kerncliff',tag:'Outside · Free',filters:['free','outdoors'],icon:'08',title:'Walk through a quarry turned wetland.',copy:'Boardwalks now cross the old quarry landscape at Kerncliff Park.',image:'assets/editorial/explore-collage.webp',position:'20% 78%',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/kerncliff-park.aspx'},
    {id:'beachway',tag:'Outside · Free',filters:['free','outdoors'],icon:'09',title:'Walk the strip between lake and highway.',copy:'Beach, dunes, canal and Skyway fit into one unusual shoreline.',image:'assets/home/skyway.webp',position:'50% 64%',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/beachway-park.aspx'},
    {id:'fishway',tag:'Wildlife · Free',filters:['free','outdoors'],icon:'10',title:'Follow the fish story upstream.',copy:'See why carp, low oxygen and one narrow passage matter.',image:'assets/home/fishway.webp',position:'50% 52%',url:'articles/fishway-26000-fish.html'},
    {id:'waterfront',tag:'Outside · Free',filters:['free','outdoors'],icon:'11',title:'Keep walking after the pier.',copy:'Follow the shoreline past Burlington’s obvious photo stop.',image:'assets/editorial/explore-collage.webp',position:'78% 78%',url:'https://www.burlington.ca/en/parks-facilities-and-rentals/spencer-smith-park.aspx'},
    {id:'ireland-house',tag:'History',filters:['history'],icon:'12',title:'Enter Burlington before the suburbs.',copy:'Ireland House preserves a family home and farm landscape.',image:'assets/editorial/explore-collage.webp',position:'50% 48%',url:'https://museumsofburlington.ca/ireland-house-museum/'}
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
    card.innerHTML = `<div class="deck-visual" aria-hidden="true"><img src="${esc(item.image)}" alt="" style="object-position:${esc(item.position)}"><span>${item.icon}</span></div><div class="deck-copy"><span class="deck-tag">${esc(item.tag)}</span><h2>${esc(item.title)}</h2><p>${esc(item.copy)}</p><div class="deck-actions"><a href="${esc(item.url)}">Reveal the place →</a><button class="done-button ${done ? 'done' : ''}" type="button">${done ? 'Explored ✓' : 'Mark explored'}</button></div></div>`;
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
  list.innerHTML = cards.map(item => `<article class="explore-row"><div class="explore-row-icon" aria-hidden="true"><img src="${esc(item.image)}" alt="" style="object-position:${esc(item.position)}"><b>${item.icon}</b></div><div><small>${esc(item.tag)}</small><strong>${esc(item.title)}</strong></div><a href="${esc(item.url)}">Details →</a></article>`).join('');
  paintProgress();
  shuffle();
})();
