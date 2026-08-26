const PURPOSES = {
  'story-tip': 'Story tip',
  'expert-source': 'Expert / source',
  partnership: 'Partnership',
  advertising: 'Advertising',
  community: 'Community organization',
  other: 'Something else'
};

const LIMITS = {
  name: 100,
  email: 254,
  organization: 150,
  phone: 50,
  purpose: 40,
  url: 500,
  message: 5000,
  website: 200,
  startedAt: 40
};

const ALLOWED_FIELDS = new Set([
  'name',
  'email',
  'organization',
  'phone',
  'purpose',
  'url',
  'message',
  'website',
  'startedAt'
]);

const MAX_BODY = 16 * 1024;
const MIN_ELAPSED_MS = 4000;
const RATE_MAX = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_ERROR = 'Something went wrong. Please try again.';
const PUBLIC_INVALID = 'Please check the form and try again.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+().\s-]{7,50}$/;
const HEADER_BAD = /[\r\n\0]/;

export { PURPOSES, LIMITS, MAX_BODY, RATE_MAX, RATE_WINDOW_MS, PUBLIC_ERROR, PUBLIC_INVALID };

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra
    }
  });
}

function htmlResponse(status, heading, copy) {
  const page = `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title><link rel="stylesheet" href="/feedback.css"></head><body class="work-page"><main class="work-main"><div class="work-shell"><p class="feedback-kicker">Work with us</p><h1>${escapeHtml(heading)}</h1><p class="feedback-lead">${escapeHtml(copy)}</p><p><a href="/work-with-us/">Back to the form</a></p></div></main></body></html>`;
  return new Response(page, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function wantsHtml(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/json')) return false;
  if (accept.includes('application/json')) return false;
  return accept.includes('text/html');
}

function respond(request, status, body) {
  if (wantsHtml(request)) {
    if (status === 200) {
      return htmlResponse(200, 'Thanks. We got your message.', 'We’ll review it and get back to you if it’s a fit.');
    }
    return htmlResponse(status, 'Something went wrong. Please try again.', 'You can go back and send the form again.');
  }
  return jsonResponse(status, body, status === 405 ? { allow: 'POST' } : {});
}

export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function logEvent(event) {
  console.log(JSON.stringify({
    event: 'contact',
    ok: Boolean(event.ok),
    status: event.status,
    purpose: event.purpose || null,
    reason: event.reason || null
  }));
}

export class MemoryLimiter {
  constructor({ max = RATE_MAX, windowMs = RATE_WINDOW_MS } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  allow(ip, now = Date.now()) {
    const kept = (this.hits.get(ip) || []).filter(time => now - time < this.windowMs);
    if (kept.length >= this.max) {
      this.hits.set(ip, kept);
      return false;
    }
    kept.push(now);
    this.hits.set(ip, kept);
    return true;
  }
}

const defaultLimiter = new MemoryLimiter();

async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return { error: 'too_large' };
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type) return { error: 'unsupported' };

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY) return { error: 'too_large' };

  if (type.includes('application/json')) {
    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
      return { error: 'invalid_json' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'invalid_json' };
    return { fields: data };
  }

  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const clone = new Request('https://burlingtonnews.ca/api/contact', {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') },
      body: buffer
    });
    const form = await clone.formData();
    const fields = {};
    for (const [key, value] of form.entries()) {
      if (typeof value !== 'string') return { error: 'attachment' };
      fields[key] = value;
    }
    return { fields };
  }

  return { error: 'unsupported' };
}

export function validateFields(fields, now = Date.now()) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return { error: 'invalid_json' };
  }

  const unexpected = Object.keys(fields).filter(key => !ALLOWED_FIELDS.has(key));
  if (unexpected.length) return { error: 'unexpected' };

  if (String(fields.website ?? '').trim()) return { drop: 'honeypot' };

  const raw = {};
  for (const key of ALLOWED_FIELDS) {
    const value = fields[key];
    if (value == null) {
      raw[key] = '';
      continue;
    }
    if (typeof value !== 'string') return { error: 'invalid' };
    if (HEADER_BAD.test(value)) return { error: 'injection' };
    raw[key] = value;
  }

  if (raw.message.length > LIMITS.message) return { error: 'message_length', field: 'message' };
  if (raw.name.length > LIMITS.name + 20) return { error: 'length', field: 'name' };
  if (raw.email.length > LIMITS.email + 20) return { error: 'email', field: 'email' };

  const name = raw.name.trim();
  const email = raw.email.trim();
  const organization = raw.organization.trim();
  const phone = raw.phone.trim();
  const purpose = raw.purpose.trim();
  const url = raw.url.trim();
  const message = raw.message.trim();

  if (!name) return { error: 'required', field: 'name' };
  if (name.length > LIMITS.name) return { error: 'length', field: 'name' };
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) return { error: 'email', field: 'email' };
  if (!PURPOSES[purpose]) return { error: 'purpose', field: 'purpose' };
  if (!message) return { error: 'required', field: 'message' };
  if (organization.length > LIMITS.organization) return { error: 'length', field: 'organization' };
  if (phone && (phone.length > LIMITS.phone || !PHONE_RE.test(phone))) return { error: 'phone', field: 'phone' };
  if (url) {
    if (url.length > LIMITS.url) return { error: 'length', field: 'url' };
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { error: 'url', field: 'url' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'url', field: 'url' };
  }

  const started = Number(raw.startedAt);
  if (!Number.isFinite(started) || now - started < MIN_ELAPSED_MS || started > now + 5000 || now - started > 24 * 60 * 60 * 1000) {
    return { error: 'too_fast' };
  }

  return {
    ok: true,
    data: { name, email, organization, phone, purpose, url, message }
  };
}

export function buildEmail(data, submittedAt = new Date()) {
  const label = PURPOSES[data.purpose];
  const lines = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.organization ? `Organization: ${data.organization}` : null,
    data.phone ? `Phone: ${data.phone}` : null,
    `Purpose: ${label}`,
    data.url ? `Relevant URL: ${data.url}` : null,
    `Submitted: ${submittedAt.toISOString()}`,
    '',
    data.message
  ].filter(line => line !== null);

  return {
    subject: `[Burlington News] Work With Us: ${label}`,
    text: lines.join('\n')
  };
}

async function sendResend(env, data, email) {
  const key = env.RESEND_API_KEY;
  const to = env.CONTACT_EMAIL_TO || 'feedback@burlingtonnews.ca';
  const from = env.CONTACT_EMAIL_FROM;
  if (!key || !from) {
    const error = new Error('missing_config');
    throw error;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: data.email,
      subject: email.subject,
      text: email.text
    })
  });

  if (!response.ok) throw new Error('provider');
}

export async function handleContact(request, env = {}, deps = {}) {
  const limiter = deps.limiter || defaultLimiter;
  const sendEmail = deps.sendEmail || ((nextEnv, data, email) => sendResend(nextEnv, data, email));
  const now = deps.now ? deps.now() : Date.now();

  if (request.method !== 'POST') {
    logEvent({ ok: false, status: 405, reason: 'method' });
    return respond(request, 405, { ok: false, error: PUBLIC_ERROR });
  }

  const ip = clientIp(request);
  if (!limiter.allow(ip, now)) {
    logEvent({ ok: false, status: 429, reason: 'rate_limit' });
    return respond(request, 429, { ok: false, error: PUBLIC_ERROR });
  }

  let parsed;
  try {
    parsed = await parseBody(request);
  } catch {
    logEvent({ ok: false, status: 400, reason: 'parse' });
    return respond(request, 400, { ok: false, error: PUBLIC_INVALID });
  }

  if (parsed.error === 'too_large') {
    logEvent({ ok: false, status: 413, reason: 'too_large' });
    return respond(request, 413, { ok: false, error: PUBLIC_INVALID });
  }
  if (parsed.error) {
    logEvent({ ok: false, status: 400, reason: parsed.error });
    return respond(request, 400, { ok: false, error: PUBLIC_INVALID });
  }

  const result = validateFields(parsed.fields, now);
  if (result.drop === 'honeypot') {
    logEvent({ ok: true, status: 200, reason: 'honeypot' });
    return respond(request, 200, { ok: true });
  }
  if (!result.ok) {
    logEvent({ ok: false, status: 400, reason: result.error, purpose: parsed.fields.purpose });
    return respond(request, 400, { ok: false, error: PUBLIC_INVALID, field: result.field || null });
  }

  const email = buildEmail(result.data, new Date(now));
  if (env.CONTACT_DRY_RUN === '1') {
    logEvent({ ok: true, status: 200, purpose: result.data.purpose, reason: 'dry_run' });
    return respond(request, 200, { ok: true });
  }

  try {
    await sendEmail(env, result.data, email);
  } catch (error) {
    const reason = error && error.message === 'missing_config' ? 'config' : 'provider';
    logEvent({ ok: false, status: 500, purpose: result.data.purpose, reason });
    return respond(request, 500, { ok: false, error: PUBLIC_ERROR });
  }

  logEvent({ ok: true, status: 200, purpose: result.data.purpose });
  return respond(request, 200, { ok: true });
}
