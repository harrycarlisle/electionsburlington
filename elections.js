(() => {
  const DATA_URL = '/data/mayoral-candidates.json';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const strip = document.getElementById('candidateStrip');
  const profile = document.getElementById('profilePanel');
  const selector = document.getElementById('candidateSelect');
  const dots = document.getElementById('candidateDots');
  const intro = document.querySelector('#candidates .section-intro');
  if (!strip || !profile) return;

  let data = null;
  let activeCandidateId = '';
  let observer = null;
  let scrollingToId = '';
  let openIssues = new Set();

  const byId = id => data.candidates.find(item => item.id === id);
  const bySlug = slug => data.candidates.find(item => item.slug === slug);
  const ids = () => data.candidates.map(item => item.id);

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
      return `<img class="${className}" src="${esc(candidate.image)}" alt="Portrait of ${esc(candidate.name)}" width="480" height="360">`;
    }
    return `<div class="${className === 'candidate-photo' ? 'photo-placeholder' : 'mini-placeholder'}" aria-label="No verified public photo for ${esc(candidate.name)}">${esc(initials(candidate.name))}</div>`;
  }

  function isRailMode() {
    const style = getComputedStyle(strip);
    return style.display === 'flex' && /auto|scroll/.test(style.overflowX);
  }

  function sentences(text) {
    return String(text || '').split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean).slice(0, 4);
  }

  function unlockIfSettled(id) {
    if (scrollingToId !== id) return;
    if (nearestCardId() === id) {
      scrollingToId = '';
      return;
    }
    requestAnimationFrame(() => unlockIfSettled(id));
  }

  function waitForStripSettle(done) {
    let last = strip.scrollLeft;
    let stable = 0;
    const step = () => {
      if (Math.abs(strip.scrollLeft - last) < 1) {
        stable += 1;
        if (stable >= 5) {
          done();
          return;
        }
      } else {
        stable = 0;
        last = strip.scrollLeft;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setActive(id, { scroll = false, hash = true } = {}) {
    if (!byId(id)) return;
    const changed = id !== activeCandidateId;
    if (!changed && !scroll) return;
    activeCandidateId = id;
    strip.querySelectorAll('.candidate-card').forEach(card => {
      const on = card.dataset.id === id;
      card.setAttribute('aria-selected', String(on));
      card.setAttribute('aria-current', on ? 'true' : 'false');
      card.classList.toggle('is-active', on);
    });
    strip.setAttribute('aria-activedescendant', `candidate-card-${id}`);
    if (selector && selector.value !== id) selector.value = id;
    dots?.querySelectorAll('[data-id]').forEach(dot => {
      const on = dot.dataset.id === id;
      dot.classList.toggle('is-active', on);
      dot.setAttribute('aria-current', on ? 'true' : 'false');
    });
    if (changed) {
      openIssues = new Set();
      renderProfile();
    }
    if (hash) {
      const next = hashFor(byId(id));
      if (location.hash !== next) history.replaceState(null, '', next);
    }
    if (scroll && isRailMode()) {
      const card = strip.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!card) return;
      scrollingToId = id;
      const finish = () => { if (scrollingToId === id) scrollingToId = ''; };
      strip.addEventListener('scrollend', finish, { once: true });
      card.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest'
      });
      waitForStripSettle(finish);
      requestAnimationFrame(() => unlockIfSettled(id));
    } else {
      scrollingToId = '';
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

  function syncFromRail() {
    if (scrollingToId || !isRailMode()) return;
    setActive(nearestCardId(), { hash: true });
  }

  function watchStrip() {
    observer?.disconnect();
    if (!isRailMode()) return;
    const cards = [...strip.querySelectorAll('.candidate-card')];
    observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const nextId = visible[0]?.intersectionRatio >= 0.55 ? visible[0].target.dataset.id : nearestCardId();
      if (scrollingToId && nextId !== scrollingToId) return;
      setActive(nextId, { hash: true });
    }, { root: strip, threshold: [0.45, 0.55, 0.7, 0.85] });
    cards.forEach(card => observer.observe(card));
  }

  function renderCards() {
    strip.innerHTML = data.candidates.map(candidate => `
      <button type="button" class="candidate-card" id="candidate-card-${esc(candidate.id)}" data-id="${esc(candidate.id)}" role="option" aria-selected="${candidate.id === activeCandidateId}" aria-current="${candidate.id === activeCandidateId ? 'true' : 'false'}">
        ${photo(candidate)}
        <div class="candidate-body">
          <h3>${esc(candidate.name)}</h3>
          <div class="focus-label">${esc(candidate.currentRole)}</div>
          <p>${esc(candidate.cardSummary)}</p>
        </div>
      </button>`).join('');
    strip.setAttribute('role', 'listbox');
    strip.setAttribute('aria-label', 'Mayoral candidates');
    strip.setAttribute('tabindex', '0');
    strip.setAttribute('aria-activedescendant', `candidate-card-${activeCandidateId}`);
    strip.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => setActive(card.dataset.id, { scroll: true }));
    });
    if (selector) {
      selector.innerHTML = data.candidates.map(candidate => `<option value="${esc(candidate.id)}">${esc(candidate.name)}</option>`).join('');
      selector.value = activeCandidateId;
    }
    if (dots) {
      dots.innerHTML = data.candidates.map(candidate => `<button type="button" data-id="${esc(candidate.id)}" aria-label="View ${esc(candidate.name)}" aria-current="${candidate.id === activeCandidateId ? 'true' : 'false'}"></button>`).join('');
      dots.querySelectorAll('[data-id]').forEach(dot => {
        dot.addEventListener('click', () => setActive(dot.dataset.id, { scroll: true }));
      });
    }
    watchStrip();
  }

  function renderProfile() {
    const candidate = byId(activeCandidateId);
    if (!candidate) return;
    const desktop = window.matchMedia('(min-width:721px)').matches;
    const issues = data.issueOrder.map((key, index) => {
      const meta = data.issues[key];
      const row = candidate.issues[key] || {};
      const panelId = `issue-${candidate.id}-${key}`;
      const buttonId = `issue-btn-${candidate.id}-${key}`;
      const expanded = openIssues.has(key) || (desktop && index === 0 && openIssues.size === 0);
      const points = (row.bullets && row.bullets.length) ? row.bullets : sentences(row.detail);
      return `<div class="issue-accordion">
        <button type="button" class="issue-toggle" id="${buttonId}" data-issue="${esc(key)}" aria-expanded="${expanded}" aria-controls="${panelId}">
          <span>
            <strong>${esc(meta.label)}</strong>
            <em>${esc(row.summary || 'No detailed public position found yet.')}</em>
          </span>
        </button>
        <div class="issue-panel" id="${panelId}" role="region" aria-labelledby="${buttonId}" ${expanded ? '' : 'hidden'}>
          ${points.length ? `<ul>${points.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>No further public detail found yet.</p>'}
          ${meta.source ? `<a href="${esc(meta.source)}" target="_blank" rel="noopener">Public record</a>` : ''}
        </div>
      </div>`;
    }).join('');
    const questionsId = `questions-${candidate.id}`;
    profile.innerHTML = `
      <div class="profile-head">
        <div>
          <div class="eyebrow">${esc(candidate.currentRole)}</div>
          <h2>${esc(candidate.name)}</h2>
          <p class="profile-line">${esc(candidate.profileLine)}</p>
        </div>
      </div>
      <div class="profile-box experience-box">
        <h3>Experience &amp; record</h3>
        <ul>${candidate.experience.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div class="issues-stack">
        <h3>The issues</h3>
        ${issues}
      </div>
      <div class="questions-accordion">
        <button type="button" class="questions-toggle" aria-expanded="false" aria-controls="${questionsId}">Questions still unanswered</button>
        <ul id="${questionsId}" hidden>${candidate.unansweredQuestions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div class="source-links">
        ${candidate.sources.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)} ↗</a>`).join('')}
        <a href="/head-to-head.html">Compare two candidates</a>
      </div>`;
    profile.querySelectorAll('.issue-toggle').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.issue;
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        const open = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!open));
        if (panel) panel.hidden = open;
        if (open) openIssues.delete(key);
        else openIssues.add(key);
      });
    });
    const questionsToggle = profile.querySelector('.questions-toggle');
    questionsToggle?.addEventListener('click', () => {
      const panel = document.getElementById(questionsToggle.getAttribute('aria-controls'));
      const open = questionsToggle.getAttribute('aria-expanded') === 'true';
      questionsToggle.setAttribute('aria-expanded', String(!open));
      if (panel) panel.hidden = open;
    });
  }

  function bindControls() {
    selector?.addEventListener('change', () => setActive(selector.value, { scroll: true }));
    window.addEventListener('hashchange', () => setActive(idFromHash(), { scroll: true, hash: false }));
    strip.addEventListener('scrollend', syncFromRail, { passive: true });
    strip.addEventListener('keydown', event => {
      const order = ids();
      const index = order.indexOf(activeCandidateId);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(order[Math.min(order.length - 1, index + 1)], { scroll: true });
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(order[Math.max(0, index - 1)], { scroll: true });
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActive(order[0], { scroll: true });
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActive(order[order.length - 1], { scroll: true });
      }
    });
    window.addEventListener('resize', () => {
      watchStrip();
      if (isRailMode()) {
        const card = strip.querySelector(`[data-id="${CSS.escape(activeCandidateId)}"]`);
        card?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      }
    });
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
      if (location.hash || isRailMode()) {
        requestAnimationFrame(() => setActive(activeCandidateId, { scroll: true, hash: Boolean(location.hash) }));
      }
    })
    .catch(() => {
      profile.innerHTML = '<p class="muted">Candidate details could not load. Refresh the page.</p>';
    });
})();
