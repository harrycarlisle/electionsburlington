(() => {
  const DATA_URL = '/data/mayoral-candidates.json';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const strip = document.getElementById('candidateStrip');
  const profile = document.getElementById('profilePanel');
  const selector = document.getElementById('candidateSelect');
  const intro = document.querySelector('#candidates .section-intro');
  if (!strip || !profile) return;

  let data = null;
  let activeCandidateId = '';
  let observer = null;
  let scrollingToId = '';

  const byId = id => data.candidates.find(item => item.id === id);
  const bySlug = slug => data.candidates.find(item => item.slug === slug);

  function hashFor(candidate) {
    return `#${candidate.slug}`;
  }

  function idFromHash() {
    const slug = location.hash.replace(/^#/, '');
    return bySlug(slug)?.id || data.candidates[0].id;
  }

  function initials(name) {
    return name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
  }

  function photo(candidate, className = 'candidate-photo') {
    if (candidate.image) {
      return `<img class="${className}" src="${esc(candidate.image)}" alt="${esc(candidate.name)}" width="480" height="360">`;
    }
    return `<div class="${className === 'candidate-photo' ? 'photo-placeholder' : 'mini-placeholder'}" aria-label="No verified public photo for ${esc(candidate.name)}">${esc(initials(candidate.name))}</div>`;
  }

  function setActive(id, { scroll = false, hash = true } = {}) {
    if (!byId(id)) return;
    if (id === activeCandidateId && !scroll) return;
    activeCandidateId = id;
    strip.querySelectorAll('.candidate-card').forEach(card => {
      const on = card.dataset.id === id;
      card.setAttribute('aria-pressed', String(on));
      card.setAttribute('aria-current', on ? 'true' : 'false');
      card.classList.toggle('is-active', on);
    });
    if (selector && selector.value !== id) selector.value = id;
    renderProfile();
    if (hash) {
      const next = hashFor(byId(id));
      if (location.hash !== next) history.replaceState(null, '', next);
    }
    if (scroll) {
      const card = strip.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!card) return;
      scrollingToId = id;
      card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      window.setTimeout(() => { scrollingToId = ''; }, 500);
    }
  }

  function nearestCardId() {
    const bounds = strip.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    let best = activeCandidateId;
    let bestDist = Infinity;
    strip.querySelectorAll('.candidate-card').forEach(card => {
      const box = card.getBoundingClientRect();
      const dist = Math.abs(box.left + box.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = card.dataset.id;
      }
    });
    return best;
  }

  function watchStrip() {
    observer?.disconnect();
    const cards = [...strip.querySelectorAll('.candidate-card')];
    observer = new IntersectionObserver(entries => {
      if (scrollingToId) return;
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]?.intersectionRatio >= 0.55) {
        setActive(visible[0].target.dataset.id, { hash: true });
        return;
      }
      setActive(nearestCardId(), { hash: true });
    }, { root: strip, threshold: [0.45, 0.6, 0.75] });
    cards.forEach(card => observer.observe(card));
    strip.addEventListener('scroll', () => {
      if (scrollingToId) return;
      window.clearTimeout(strip._snapTimer);
      strip._snapTimer = window.setTimeout(() => setActive(nearestCardId(), { hash: true }), 80);
    }, { passive: true });
  }

  function renderCards() {
    strip.innerHTML = data.candidates.map(candidate => `
      <button type="button" class="candidate-card" data-id="${esc(candidate.id)}" aria-pressed="${candidate.id === activeCandidateId}" aria-current="${candidate.id === activeCandidateId ? 'true' : 'false'}">
        ${photo(candidate)}
        <div class="candidate-body">
          <h3>${esc(candidate.name)}</h3>
          <div class="focus-label">${esc(candidate.currentRole)}</div>
          <p>${esc(candidate.cardSummary)}</p>
        </div>
      </button>`).join('');
    strip.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => setActive(card.dataset.id, { scroll: true }));
    });
    if (selector) {
      selector.innerHTML = data.candidates.map(candidate => `<option value="${esc(candidate.id)}">${esc(candidate.name)}</option>`).join('');
      selector.value = activeCandidateId;
    }
    watchStrip();
  }

  function renderProfile() {
    const candidate = byId(activeCandidateId);
    if (!candidate) return;
    const issues = data.issueOrder.map((key, index) => {
      const meta = data.issues[key];
      const row = candidate.issues[key] || {};
      const panelId = `issue-${candidate.id}-${key}`;
      const open = window.matchMedia('(min-width:721px)').matches && index === 0 ? ' open' : '';
      return `<details class="issue-accordion"${open}>
        <summary>
          <span>
            <strong>${esc(meta.label)}</strong>
            <em>${esc(row.summary || 'No detailed public position found yet.')}</em>
          </span>
        </summary>
        <div class="issue-panel" id="${panelId}">
          ${row.detail ? `<p>${esc(row.detail)}</p>` : ''}
          ${meta.why ? `<p class="issue-context-copy">${esc(meta.why)}</p>` : ''}
          ${meta.source ? `<a href="${esc(meta.source)}" target="_blank" rel="noopener">Source</a>` : ''}
        </div>
      </details>`;
    }).join('');
    profile.innerHTML = `
      <div class="profile-head">
        <div>
          <div class="eyebrow">${esc(candidate.currentRole)}</div>
          <h2>${esc(candidate.name)}</h2>
          <p class="profile-line">${esc(candidate.profileLine)}</p>
        </div>
      </div>
      <div class="profile-box experience-box">
        <h3>Experience & record</h3>
        <ul>${candidate.experience.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div class="issues-stack">
        <h3>The issues</h3>
        ${issues}
      </div>
      <details class="profile-more questions-accordion">
        <summary>Questions still unanswered</summary>
        <ul>${candidate.unansweredQuestions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </details>
      <div class="source-links">
        ${candidate.sources.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)} ↗</a>`).join('')}
        <a href="/head-to-head.html">Compare two candidates</a>
      </div>`;
  }

  function bindControls() {
    selector?.addEventListener('change', () => setActive(selector.value, { scroll: true }));
    window.addEventListener('hashchange', () => setActive(idFromHash(), { scroll: true, hash: false }));
    if (intro) intro.textContent = 'Compare Burlington’s mayoral candidates, their priorities and their records.';
  }

  fetch(DATA_URL, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(payload => {
      data = payload;
      activeCandidateId = idFromHash();
      bindControls();
      renderCards();
      renderProfile();
      if (location.hash) {
        requestAnimationFrame(() => setActive(activeCandidateId, { scroll: true, hash: false }));
      }
    })
    .catch(() => {
      profile.innerHTML = '<p class="muted">Candidate details could not load. Refresh the page.</p>';
    });
})();
