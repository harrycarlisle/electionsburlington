(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  fetch('/data/mayoral-candidates.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => {
      const order = data.candidates.map(item => item.id);
      const profiles = Object.fromEntries(data.candidates.map(item => [item.id, item]));
      const params = new URLSearchParams(location.search);
      let left = profiles[params.get('left')] ? params.get('left') : 'mw';
      let right = profiles[params.get('right')] ? params.get('right') : 'lk';
      if (left === right) right = order.find(id => id !== left) || right;
      let issue = data.issues[params.get('issue')] ? params.get('issue') : data.issueOrder[0];
      let locked = null;
      const initials = name => name.split(/\s+/).map(part => part[0]).slice(0,2).join('');
      const photo = (id, name, cls='person-photo', ph='person-placeholder') => {
        const candidate = profiles[id];
        return candidate.image
          ? `<img class="${cls}" src="${esc(candidate.image)}" alt="${esc(name)}">`
          : `<div class="${ph}" aria-label="No verified public photo for ${esc(name)}">${esc(initials(name))}</div>`;
      };
      const options = selected => order.map(id => `<option value="${id}" ${id===selected?'selected':''}>${esc(profiles[id].name)}</option>`).join('');
      const issueOptions = () => data.issueOrder.map(key => `<option value="${key}" ${key===issue?'selected':''}>${esc(data.issues[key].label)}</option>`).join('');
      const card = (id, side) => {
        const candidate = profiles[id];
        const kept = locked === side;
        return `${photo(id, candidate.name)}<div class="person-select"><label class="skip" for="${side}Select">${side==='left'?'Left':'Right'} candidate</label><select id="${side}Select">${options(id)}</select></div><div class="role">${esc(candidate.currentRole)}</div><button class="keep-candidate" type="button" data-keep="${side}" aria-pressed="${kept}">${kept?'Keeping '+esc(candidate.name):'Keep '+esc(candidate.name)+' · change opponent'}</button><div class="keep-note">${kept?'Choose a different opponent on the other side.':''}</div><div class="fact"><b>Background</b><p>${esc(candidate.experience[0]||'')}</p></div><div class="fact"><b>Question to ask</b><p>${esc(candidate.unansweredQuestions[0]||'')}</p></div><div class="fact"><b>Source</b><p><a href="${esc(candidate.sources[0].url)}" target="_blank" rel="noopener">${esc(candidate.sources[0].label)} ↗</a></p></div>`;
      };
      const position = id => {
        const candidate = profiles[id];
        const row = candidate.issues[issue] || {};
        return `<article class="position"><h3>${esc(candidate.name)}</h3><p>${esc(row.summary||'')}</p>${row.detail?`<p>${esc(row.detail)}</p>`:''}</article>`;
      };
      const syncUrl = () => {
        const next = new URL(location.href);
        next.searchParams.set('left', left);
        next.searchParams.set('right', right);
        next.searchParams.set('issue', issue);
        history.replaceState(null, '', `${next.pathname}${next.search}${next.hash}`);
      };
      const render = () => {
        const L = profiles[left], R = profiles[right], I = data.issues[issue];
        document.getElementById('leftCard').innerHTML = card(left,'left');
        document.getElementById('rightCard').innerHTML = card(right,'right');
        document.getElementById('issue').innerHTML = issueOptions();
        document.getElementById('titleRow').innerHTML = `<div class="title-person">${photo(left,L.name,'title-photo','title-placeholder')}<div class="title-name">${esc(L.name)}</div></div><div class="vs">vs</div><div class="title-person right"><div class="title-name">${esc(R.name)}</div>${photo(right,R.name,'title-photo','title-placeholder')}</div>`;
        document.getElementById('context').innerHTML = `<h2>${esc(I.contextTitle)}</h2><p>${esc(I.why)}</p>`;
        document.getElementById('compare').innerHTML = position(left)+position(right);
        document.getElementById('bottomStrip').innerHTML = `<div class="bottom-box"><b>${esc(L.name)}: what still needs checking</b><p>${esc(L.unansweredQuestions[0]||'')}</p></div><div class="bottom-box"><b>${esc(R.name)}: what still needs checking</b><p>${esc(R.unansweredQuestions[0]||'')}</p></div>`;
        syncUrl();
        document.getElementById('leftSelect').addEventListener('change', e => { left = e.target.value; if (locked==='left') locked=null; if (left===right) right=order.find(id => id!==left); render(); });
        document.getElementById('rightSelect').addEventListener('change', e => { right = e.target.value; if (locked==='right') locked=null; if (right===left) left=order.find(id => id!==right); render(); });
        document.getElementById('issue').addEventListener('change', e => { issue = e.target.value; render(); });
        document.querySelectorAll('[data-keep]').forEach(button => button.addEventListener('click', () => {
          locked = button.dataset.keep;
          render();
          const target = document.getElementById(locked==='left'?'rightSelect':'leftSelect');
          target?.focus();
        }));
      };
      render();
    })
    .catch(() => {
      const center = document.getElementById('compare');
      if (center) center.innerHTML = '<p>Candidate comparison could not load.</p>';
    });
})();
