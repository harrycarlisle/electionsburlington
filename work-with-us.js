(() => {
  const form = document.getElementById('workForm');
  if (!form) return;

  const status = document.getElementById('workStatus');
  const submit = document.getElementById('workSubmit');
  const started = document.getElementById('workStartedAt');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const purposes = new Set(['story-tip', 'expert-source', 'partnership', 'advertising', 'community', 'other']);

  if (started && !started.value) started.value = String(Date.now());

  function setStatus(kind, title, support) {
    if (!status) return;
    status.className = `feedback-status${kind ? ` ${kind}` : ''}`;
    if (support) {
      status.innerHTML = `<span>${title}</span><span class="work-status-support">${support}</span>`;
    } else {
      status.textContent = title;
    }
  }

  function fieldError(id, message) {
    const field = document.getElementById(id);
    const err = document.getElementById(`${id}-error`);
    if (field) field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (err) {
      err.textContent = message || '';
      err.hidden = !message;
    }
    return field;
  }

  function clearErrors() {
    ['workName', 'workEmail', 'workPurpose', 'workMessage'].forEach(id => fieldError(id, ''));
  }

  function validate() {
    clearErrors();
    let first = null;
    const name = form.elements.name.value.trim();
    if (!name) first = first || fieldError('workName', 'Enter your name.');
    const email = form.elements.email.value.trim();
    if (!email || !emailRe.test(email)) first = first || fieldError('workEmail', 'Enter a valid email.');
    const purpose = form.elements.purpose.value;
    if (!purposes.has(purpose)) first = first || fieldError('workPurpose', 'Choose what this is about.');
    const message = form.elements.message.value.trim();
    if (!message) first = first || fieldError('workMessage', 'Enter a message.');
    if (form.elements.message.value.length > 5000) first = first || fieldError('workMessage', 'Keep the message under 5,000 characters.');
    return first;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit?.disabled) return;

    const first = validate();
    if (first) {
      first.focus();
      return;
    }

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      organization: form.elements.organization.value.trim(),
      phone: form.elements.phone.value.trim(),
      purpose: form.elements.purpose.value,
      url: form.elements.url.value.trim(),
      message: form.elements.message.value.trim(),
      website: form.elements.website.value,
      startedAt: started?.value || String(Date.now() - 5000)
    };

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sending…';
    }
    setStatus('', 'Sending…');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error('fail');
      setStatus('is-success', 'Thanks. We got your message.', 'We’ll review it and get back to you if it’s a fit.');
      form.reset();
      if (started) started.value = String(Date.now());
    } catch (_) {
      setStatus('is-error', 'Something went wrong. Please try again.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Send message';
      }
    }
  });
})();
