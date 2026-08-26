import assert from 'node:assert/strict';
import {
  handleContact,
  validateFields,
  buildEmail,
  MemoryLimiter,
  PUBLIC_ERROR,
  PUBLIC_INVALID,
  PURPOSES
} from '../lib/contact.js';

const now = Date.now();
const startedAt = String(now - 8000);

function payload(overrides = {}) {
  return {
    name: 'Alex Rivera',
    email: 'alex@example.com',
    organization: 'Ward shop',
    phone: '905-555-0100',
    purpose: 'story-tip',
    url: 'https://example.com/tip',
    message: 'A local business is expanding on Brant Street.',
    website: '',
    startedAt,
    ...overrides
  };
}

function request(method, body, headers = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['content-type'] = init.headers['content-type'] || 'application/json';
  }
  return new Request('https://burlingtonnews.ca/api/contact', init);
}

async function read(response) {
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text, headers: response.headers };
}

async function run() {
  let sent = [];
  const sendEmail = async (_env, data, email) => {
    sent.push({ data, email });
  };
  const limiter = new MemoryLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
  const deps = { sendEmail, limiter, now: () => now };

  const valid = await read(await handleContact(request('POST', payload()), {}, deps));
  assert.equal(valid.status, 200);
  assert.equal(valid.json.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email.subject, '[Burlington News] Work With Us: Story tip');
  assert.match(sent[0].email.text, /Name: Alex Rivera/);
  assert.match(sent[0].email.text, /Purpose: Story tip/);
  assert.match(sent[0].email.text, /Submitted: /);

  const missingName = validateFields(payload({ name: '   ' }), now);
  assert.equal(missingName.error, 'required');
  assert.equal(missingName.field, 'name');

  const invalidEmail = validateFields(payload({ email: 'not-an-email' }), now);
  assert.equal(invalidEmail.error, 'email');

  const missingPurpose = validateFields(payload({ purpose: '' }), now);
  assert.equal(missingPurpose.error, 'purpose');

  const missingMessage = validateFields(payload({ message: '' }), now);
  assert.equal(missingMessage.error, 'required');
  assert.equal(missingMessage.field, 'message');

  const overlong = validateFields(payload({ message: 'x'.repeat(5001) }), now);
  assert.equal(overlong.error, 'message_length');

  sent = [];
  const honeypot = await read(await handleContact(request('POST', payload({ website: 'https://spam.test' })), {}, {
    sendEmail,
    limiter: new MemoryLimiter(),
    now: () => now
  }));
  assert.equal(honeypot.status, 200);
  assert.equal(honeypot.json.ok, true);
  assert.equal(sent.length, 0);

  const tight = new MemoryLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
  for (let i = 0; i < 5; i += 1) {
    const ok = await handleContact(request('POST', payload()), { CONTACT_DRY_RUN: '1' }, { limiter: tight, now: () => now });
    assert.equal(ok.status, 200);
  }
  const limited = await read(await handleContact(request('POST', payload()), { CONTACT_DRY_RUN: '1' }, { limiter: tight, now: () => now }));
  assert.equal(limited.status, 429);
  assert.equal(limited.json.error, PUBLIC_ERROR);

  sent = [];
  const provider = await read(await handleContact(request('POST', payload()), {}, {
    sendEmail: async () => { throw new Error('provider'); },
    limiter: new MemoryLimiter(),
    now: () => now
  }));
  assert.equal(provider.status, 500);
  assert.equal(provider.json.error, PUBLIC_ERROR);
  assert.equal(sent.length, 0);
  assert.doesNotMatch(provider.text, /provider|stack|RESEND/i);

  const get = await read(await handleContact(request('GET'), {}, { limiter: new MemoryLimiter() }));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');

  const html = buildEmail({
    name: 'Alex',
    email: 'alex@example.com',
    organization: '',
    phone: '',
    purpose: 'story-tip',
    url: '',
    message: '<script>alert(1)</script>\nBcc: evil@example.com'
  }, new Date('2026-08-26T12:00:00.000Z'));
  assert.match(html.text, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html.subject, /</);
  assert.equal(html.subject, '[Burlington News] Work With Us: Story tip');

  const injectedPurpose = validateFields(payload({ purpose: 'story-tip\nBcc: evil@example.com' }), now);
  assert.equal(injectedPurpose.error, 'injection');

  const injectedName = validateFields(payload({ name: 'Alex\r\nBcc: evil@example.com' }), now);
  assert.equal(injectedName.error, 'injection');

  const unknownPurpose = validateFields(payload({ purpose: '<b>hack</b>' }), now);
  assert.equal(unknownPurpose.error, 'purpose');
  assert.ok(!PURPOSES['<b>hack</b>']);

  const unexpected = validateFields(payload({ extra: 'nope' }), now);
  assert.equal(unexpected.error, 'unexpected');

  const tooFast = validateFields(payload({ startedAt: String(now) }), now);
  assert.equal(tooFast.error, 'too_fast');

  sent = [];
  const dry = await read(await handleContact(request('POST', payload()), { CONTACT_DRY_RUN: '1' }, {
    sendEmail,
    limiter: new MemoryLimiter(),
    now: () => now
  }));
  assert.equal(dry.status, 200);
  assert.equal(sent.length, 0);

  const form = new URLSearchParams(payload());
  const formRes = await read(await handleContact(new Request('https://burlingtonnews.ca/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/html'
    },
    body: form.toString()
  }), { CONTACT_DRY_RUN: '1' }, { limiter: new MemoryLimiter(), now: () => now }));
  assert.equal(formRes.status, 200);
  assert.match(formRes.text, /Thanks\. We got your message/);
  assert.match(formRes.headers.get('content-type'), /text\/html/);

  const missingConfig = await read(await handleContact(request('POST', payload()), {}, {
    limiter: new MemoryLimiter(),
    now: () => now
  }));
  assert.equal(missingConfig.status, 500);
  assert.equal(missingConfig.json.error, PUBLIC_ERROR);

  const invalidClient = await read(await handleContact(request('POST', payload({ email: 'nope' })), {}, {
    limiter: new MemoryLimiter(),
    now: () => now
  }));
  assert.equal(invalidClient.status, 400);
  assert.equal(invalidClient.json.error, PUBLIC_INVALID);

  console.log('contact api tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
