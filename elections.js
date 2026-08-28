(() => {
  const DATA_URL = '/data/mayoral-candidates.json';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const strip = document.getElementById('candidateStrip');
  const profile = document.getElementById('profilePanel');
  const compare = document.getElementById('issueCompare');
  const selector = document.getElementById('candidateSelect');
  const intro = document.querySelector('#candidates .section-intro');
  if (!strip || !profile) return;

  let data = null;
  let activeCandidateId = '';
  let activeIssue = '';

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

  function usefulExplain(row) {
    const detail = String(row?.detail || '').replace(/\s+/g, ' ').trim();
    const summary = String(row?.summary || '').replace(/\s+/g, ' ').trim();
    if (!detail || detail === summary) return '';
    if (/no detailed|no verified|still needed|still limited|not yet been published|has not yet published|has not published/i.test(detail)) return '';
    if (detail.length < summary.length + 40) return '';
    const extra = detail.split(/\s+/).filter(word => !summary.toLowerCase().includes(word.toLowerCase()));
    return extra.length >= 16 ? detail : '';
  }

  function setActive(id, { hash = true } = {}) {
    if (!byId(id) || id === activeCandidateId) {
      if (selector && byId(id)) selector.value = id;
      return;
    }
    activeCandidateId = id;
    strip.querySelectorAll('.candidate-card').forEach(card => {
      const on = card.dataset.id === id;
      card.setAttribute('aria-selected', String(on));
      card.setAttribute('aria-current', on ? 'true' : 'false');
      card.classList.toggle('is-active', on);
    });
    if (selector && selector.value !== id) selector.value = id;
    renderIssueCompare();
    renderProfile();
    if (hash) {
      const next = hashFor(byId(id));
      if (location.hash !== next) history.replaceState(null, '', next);
    }
  }

  function renderCards() {
    strip.innerHTML = data.candidates.map(candidate => `
      <button type="button" class="candidate-card" id="candidate-card-${esc(candidate.id)}" data-id="${esc(candidate.id)}" role="option" aria-selected="${candidate.id === activeCandidateId}">
        ${photo(candidate, 'candidate-thumb')}
        <span>
          <strong>${esc(candidate.name)}</strong>
          <small>${esc(candidate.currentRole)}</small>
        </span>
      </button>`).join('');
    strip.setAttribute('role', 'listbox');
    strip.setAttribute('aria-label', 'Mayoral candidates');
    strip.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => setActive(card.dataset.id));
    });
    renderIssueCompare();
    if (selector) {
      selector.innerHTML = data.candidates.map(candidate => `<option value="${esc(candidate.id)}">${esc(candidate.name)}</option>`).join('');
      selector.value = activeCandidateId;
    }
  }

  function renderIssueCompare() {
    if (!compare || !data) return;
    const keys = data.issueOrder || [];
    if (!activeIssue || !data.issues[activeIssue]) activeIssue = keys[0] || '';
    const meta = data.issues[activeIssue] || {};
    compare.innerHTML = `
      <h2>Compare by issue</h2>
      <div class="issue-tabs" role="tablist" aria-label="Campaign issues">
        ${keys.map(key => `<button type="button" role="tab" data-issue="${esc(key)}" aria-selected="${key === activeIssue}">${esc(data.issues[key].label)}</button>`).join('')}
      </div>
      <p class="issue-compare-label">Issue: ${esc(meta.label || '')}</p>
      <div class="issue-compare-grid">
        ${data.candidates.map(candidate => {
          const row = candidate.issues?.[activeIssue] || {};
          return `<button type="button" class="issue-compare-card${candidate.id === activeCandidateId ? ' is-active' : ''}" data-id="${esc(candidate.id)}">
            <strong>${esc(candidate.name)}</strong>
            <p>${esc(row.summary || 'No detailed public position found yet.')}</p>
          </button>`;
        }).join('')}
      </div>`;
    compare.querySelectorAll('[data-issue]').forEach(button => {
      button.addEventListener('click', () => {
        activeIssue = button.dataset.issue;
        renderIssueCompare();
      });
    });
    compare.querySelectorAll('.issue-compare-card').forEach(card => {
      card.addEventListener('click', () => setActive(card.dataset.id));
    });
  }

  function renderProfile() {
    const candidate = byId(activeCandidateId);
    if (!candidate) return;
    const issues = data.issueOrder.map(key => {
      const meta = data.issues[key];
      const row = candidate.issues[key] || {};
      const explain = usefulExplain(row);
      const explainId = `issue-explain-${candidate.id}-${key}`;
      return `<div class="issue-row">
        <strong>${esc(meta.label)}</strong>
        <p>${esc(row.summary || 'No detailed public position found yet.')}</p>
        ${explain ? `<details class="issue-explain"><summary>What does that mean?</summary><p id="${explainId}">${esc(explain)}</p></details>` : ''}
      </div>`;
    }).join('');
    const questions = (candidate.unansweredQuestions || []).slice(0, 3);
    profile.innerHTML = `
      <div class="profile-head">
        ${photo(candidate, 'profile-photo')}
        <div class="profile-identity">
          <h2>${esc(candidate.name)}</h2>
          <p class="profile-role">${esc(candidate.currentRole)}</p>
          <p class="profile-line">${esc(candidate.cardSummary)}</p>
        </div>
      </div>
      <div class="issues-stack">
        <h3>Where they stand</h3>
        ${issues}
      </div>
      <div class="profile-box experience-box">
        <h3>Experience and record</h3>
        <ul>${candidate.experience.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div class="questions-box">
        <h3>Questions still to answer</h3>
        <ul>${questions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div class="source-links">
        <strong class="source-links-label">Sources and links</strong>
        ${candidate.sources.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.label)}</a>`).join('')}
        <a href="/head-to-head.html">Compare two candidates</a>
      </div>`;
  }

  function bindControls() {
    selector?.addEventListener('change', () => setActive(selector.value));
    window.addEventListener('hashchange', () => setActive(idFromHash(), { hash: false }));
    if (intro) intro.textContent = 'Who they are, where they differ, what they have done and what they are promising next.';
  }

  fetch(DATA_URL, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(payload => {
      data = payload;
      activeCandidateId = idFromHash();
      bindControls();
      renderCards();
      renderProfile();
    })
    .catch(() => {
      profile.innerHTML = '<p class="muted">Candidate details could not load. Refresh the page.</p>';
    });
})();
