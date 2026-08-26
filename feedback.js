(() => {
  const placeholders = {
    'Something is inaccurate': 'What is incorrect?',
    'Something is confusing': 'What was unclear?',
    'Something is missing': 'What should we add?',
    'Accessibility issue': 'What made the page difficult to use?',
    'Site problem': 'What happened?',
    'General feedback': 'What would you change?'
  };

  const partnerValues = ['partner', 'partnership', 'sponsor', 'sponsorship'];

  function mark(status, kind, text) {
    if (!status) return;
    status.textContent = text;
    status.className = `feedback-status ${kind}`;
  }

  function openMail(subject, body, status) {
    mark(status, 'is-success', 'Thanks — we got it.\nWe’ll review it.');
    window.location.href = `mailto:feedback@burlingtonnews.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const feedbackForm = document.getElementById('feedbackForm');
  const feedbackStatus = document.getElementById('feedbackStatus');
  const typeSelect = document.getElementById('feedbackType');
  const message = document.getElementById('feedbackMessage');

  if (typeSelect) {
    const requested = new URLSearchParams(location.search).get('type');
    if (requested && partnerValues.includes(requested.toLowerCase())) {
      location.replace('/work-with-us/');
      return;
    }
    if (requested) {
      const wanted = requested.toLowerCase();
      const option = [...typeSelect.options].find(item => item.value.toLowerCase() === wanted || item.textContent.toLowerCase() === wanted);
      if (option) typeSelect.value = option.value;
    }
    const applyPlaceholder = () => {
      if (message) message.placeholder = placeholders[typeSelect.value] || 'What would you change?';
    };
    typeSelect.addEventListener('change', applyPlaceholder);
    applyPlaceholder();
  }

  feedbackForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(feedbackForm);
    const email = String(data.get('email') || '').trim();
    const type = String(data.get('type') || 'General feedback');
    const text = String(data.get('message') || '').trim();
    if (!text) {
      mark(feedbackStatus, 'is-error', 'Please add your feedback before sending.');
      message?.focus();
      return;
    }
    openMail(`Burlington News: ${type}`, [
      `Feedback type: ${type}`,
      email ? `Reply email: ${email}` : 'Reply email: not provided',
      `Page: ${document.referrer || 'Not provided'}`,
      '',
      text
    ].join('\n'), feedbackStatus);
  });
})();
