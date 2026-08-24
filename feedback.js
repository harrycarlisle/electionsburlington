(() => {
  const form = document.getElementById('feedbackForm');
  const status = document.getElementById('feedbackStatus');
  if (!form) return;

  const requestedType = new URLSearchParams(location.search).get('type');
  const typeSelect = document.getElementById('feedbackType');
  if (requestedType && typeSelect) {
    const wanted = requestedType.toLowerCase();
    const option = [...typeSelect.options].find(o => o.value.toLowerCase() === wanted || o.textContent.toLowerCase() === wanted);
    if (option) typeSelect.value = option.value;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const type = String(data.get('type') || 'General feedback');
    const message = String(data.get('message') || '').trim();

    if (!message) {
      status.textContent = 'Please add your feedback before sending.';
      status.className = 'feedback-status is-error';
      document.getElementById('feedbackMessage')?.focus();
      return;
    }

    const subject = `Burlington Election Guide: ${type}`;
    const body = [
      `Feedback type: ${type}`,
      email ? `Reply email: ${email}` : 'Reply email: not provided',
      `Page: ${document.referrer || 'Not provided'}`,
      '',
      message
    ].join('\n');

    status.textContent = 'Opening your email app with the feedback filled in…';
    status.className = 'feedback-status is-success';
    window.location.href = `mailto:feedback@electionsburlington.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();