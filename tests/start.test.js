// The Get started form's server side and page (Plan: Get started intake, phase 2).
// Run with: node --test tests/
// No dependencies: a fake fetch stands in for Turnstile, the engine and Resend, and counts the calls.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import handler from '../api/start.js';

// These two lists are pinned in the engine's tests too (apps/engine/tests/leads-answers.test.js and
// leads-pure.test.ts in the miloe repo). Change them in both repos, engine first.
const TYPES = ['Esthetician or spa', 'Hair salon or barber', 'Plumber', 'Electrician', 'HVAC', 'Restaurant or food', 'Retail', 'Professional services', 'Something else'];
const ANSWER_KEYS = ['phone', 'doWhat', 'otherSocial', 'likedSites', 'admired', 'branding', 'photos'];
const PAYLOAD_KEYS = ['source', 'business', 'name', 'email', 'type', 'website', 'google', 'instagram', 'facebook', 'fix', 'heard', ...ANSWER_KEYS];

const SECRET = 'k'.repeat(40);
const ENGINE = 'https://engine.test/api/intake';
const GOOD = { business: 'Sunrise Plumbing', name: 'Dana Reyes', email: 'dana@example.com', type: 'Plumber', ms: '8000', 'cf-turnstile-response': 'tok' };
const ALL_ANSWERS = {
  phone: '555 0100', doWhat: 'Plumbing and water heaters', otherSocial: 'TikTok @sunriseplumbing', likedSites: 'joesplumbing.com, clean photos',
  admired: 'Joe\'s Plumbing', branding: 'Navy and gold, logo at https://example.com/logo.png', photos: 'https://drive.google.com/drive/folders/abc',
};

const saved = {};
beforeEach(() => {
  for (const k of ['TURNSTILE_SECRET', 'LEADS_INTAKE_SECRET', 'ENGINE_INTAKE_URL', 'RESEND_API_KEY', 'NOTIFY_TO']) saved[k] = process.env[k];
  process.env.TURNSTILE_SECRET = 'ts';
  process.env.LEADS_INTAKE_SECRET = SECRET;
  process.env.ENGINE_INTAKE_URL = ENGINE;
  process.env.RESEND_API_KEY = 'rk';
  process.env.NOTIFY_TO = 'owner@example.com';
  saved.fetch = globalThis.fetch;
  saved.error = console.error;
  console.error = () => {};
});
afterEach(() => {
  for (const k of ['TURNSTILE_SECRET', 'LEADS_INTAKE_SECRET', 'ENGINE_INTAKE_URL', 'RESEND_API_KEY', 'NOTIFY_TO']) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  globalThis.fetch = saved.fetch;
  console.error = saved.error;
});

function installFetch({ turnstile = true, engine = 201 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('challenges.cloudflare.com')) return { ok: true, json: async () => ({ success: turnstile }) };
    if (u === ENGINE) return { ok: engine >= 200 && engine < 300, status: engine, text: async () => '' };
    if (u.includes('api.resend.com')) return { ok: true, status: 200, text: async () => '' };
    throw new Error('unexpected fetch ' + u);
  };
  return calls;
}

function fakeRes() {
  const r = { statusCode: 0, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k] = v; return r; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.body = String(b); return r; };
  r.end = () => r;
  return r;
}

async function post(body) {
  const res = fakeRes();
  await handler({ method: 'POST', body }, res);
  return res;
}

const toEngine = (calls) => calls.filter((c) => c.url === ENGINE);
const payloadOf = (calls) => JSON.parse(toEngine(calls)[0].init.body);
const isThanks = (res) => res.statusCode === 303 && res.headers.Location === '/start/thanks/';

test('a good submission goes to the engine once and lands on the thank-you page', async () => {
  const calls = installFetch();
  const res = await post({ ...GOOD });
  assert.ok(isThanks(res));
  assert.equal(toEngine(calls).length, 1);
});

test('the engine payload carries the 11 original keys and the 7 optional answers, in this order', async () => {
  const calls = installFetch();
  await post({ ...GOOD, ...ALL_ANSWERS, website: 'sunrise.com', google: 'g', instagram: '@s', facebook: 'f', fix: 'More calls', heard: 'A friend' });
  const payload = payloadOf(calls);
  assert.deepEqual(Object.keys(payload), PAYLOAD_KEYS);
  assert.equal(payload.source, 'grid-pulse-media');
  for (const [k, v] of Object.entries(ALL_ANSWERS)) assert.equal(payload[k], v, k);
  assert.equal('ms' in payload, false);
  assert.equal('fax' in payload, false);
});

test('the payload is signed the way the engine checks it', async () => {
  const calls = installFetch();
  await post({ ...GOOD });
  const { init } = toEngine(calls)[0];
  const ts = init.headers['X-Intake-Timestamp'];
  const expected = crypto.createHmac('sha256', SECRET).update(ts + '.' + init.body).digest('hex');
  assert.equal(init.headers['X-Intake-Signature'], expected);
});

test('only business, name, email and type are needed; every optional answer arrives empty', async () => {
  const calls = installFetch();
  const res = await post({ ...GOOD });
  assert.ok(isThanks(res));
  const payload = payloadOf(calls);
  for (const k of [...ANSWER_KEYS, 'website', 'google', 'instagram', 'facebook', 'fix', 'heard']) assert.equal(payload[k], '', k);
});

test('a filled trap field gets a quiet thank-you and nothing is sent anywhere', async () => {
  const calls = installFetch();
  const res = await post({ ...GOOD, fax: 'x' });
  assert.ok(isThanks(res));
  assert.equal(calls.length, 0);
});

test('a send under 3 seconds, or with no usable timing, gets a friendly retry page and nothing is sent', async () => {
  for (const ms of [undefined, '', 'abc', '-5', '0', '2999', 'NaN', '1e9x']) {
    const calls = installFetch();
    const body = { ...GOOD };
    if (ms === undefined) delete body.ms; else body.ms = ms;
    const res = await post(body);
    assert.equal(res.statusCode, 400, String(ms));
    assert.match(res.body, /too fast/i, String(ms));
    assert.match(res.body, /press Send again/i, String(ms));
    assert.equal(calls.length, 0, String(ms));
  }
});

test('3 seconds exactly, and a long time on the page, both go through', async () => {
  for (const ms of ['3000', '3001', '600000']) {
    const calls = installFetch();
    assert.ok(isThanks(await post({ ...GOOD, ms })), ms);
    assert.equal(toEngine(calls).length, 1);
  }
});

test('the trap is checked before the timing, so a bot gets the quiet answer, not a hint', async () => {
  installFetch();
  const res = await post({ ...GOOD, fax: 'x', ms: '10' });
  assert.ok(isThanks(res));
});

test('type is required and must be one of the 9 on the form', async () => {
  for (const type of [undefined, '', 'Home services', 'Beauty, spa or wellness', 'plumber', 'Plumber ', 'Other']) {
    const calls = installFetch();
    const body = { ...GOOD };
    if (type === undefined) delete body.type; else body.type = type;
    const res = await post(body);
    if (type === 'Plumber ') { assert.ok(isThanks(res), 'outer spaces are trimmed'); continue; }
    assert.equal(res.statusCode, 400, String(type));
    assert.match(res.body, /type of business/i);
    assert.equal(calls.length, 0, String(type));
  }
});

test('each of the 9 types goes to the engine exactly as written', async () => {
  for (const type of TYPES) {
    const calls = installFetch();
    assert.ok(isThanks(await post({ ...GOOD, type })), type);
    assert.equal(payloadOf(calls).type, type);
  }
});

test('business, name and email are still required', async () => {
  for (const patch of [{ business: '' }, { name: '  ' }, { email: 'nope' }, { email: '' }]) {
    const calls = installFetch();
    const res = await post({ ...GOOD, ...patch });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
    assert.equal(calls.length, 0);
  }
});

test('junk text is refused before anything is sent: other alphabets anywhere typed, links in business or name', async () => {
  const junk = [
    { business: 'Компания' }, { name: 'Вам перевод https://x.sslip.io' }, { business: 'Visit www.example.com now' }, { name: 'example.com/win' },
    { fix: 'مرحبا' }, { heard: '你好' },
    { doWhat: 'Сантехник' }, { phone: '٥٥٥' }, { otherSocial: 'مرحبا' }, { likedSites: '我喜欢' }, { admired: 'Σοφία' }, { branding: 'Logo 标志' },
  ];
  for (const patch of junk) {
    const calls = installFetch();
    const res = await post({ ...GOOD, ...patch });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
    assert.equal(calls.length, 0, JSON.stringify(patch));
  }
});

test('links are fine in the answers meant to hold them, and accents and emoji are fine in text', async () => {
  const calls = installFetch();
  const res = await post({ ...GOOD, likedSites: 'https://joesplumbing.com looks clean', admired: 'www.rival.com', photos: 'https://example.com/фото', fix: 'More bookings 🙂', name: 'José Núñez' });
  assert.ok(isThanks(res));
  assert.equal(toEngine(calls).length, 1);
});

test('a failed bot check sends nothing to the engine', async () => {
  const calls = installFetch({ turnstile: false });
  const res = await post({ ...GOOD });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /person/i);
  assert.equal(toEngine(calls).length, 0);
});

test('with no Turnstile secret nothing is let through', async () => {
  delete process.env.TURNSTILE_SECRET;
  const calls = installFetch();
  const res = await post({ ...GOOD });
  assert.equal(res.statusCode, 500);
  assert.equal(calls.length, 0);
});

test('each answer is cut to its limit and control characters are removed', async () => {
  const calls = installFetch();
  await post({ ...GOOD, phone: '5'.repeat(90), doWhat: 'd'.repeat(300), likedSites: 'one\u0000\u0001\r\ntwo\u007f', business: 'b'.repeat(300) });
  const p = payloadOf(calls);
  assert.equal(p.phone.length, 40);
  assert.equal(p.doWhat.length, 200);
  assert.equal(p.likedSites, 'one\ntwo');
  assert.equal(p.business.length, 200);
});

test('every field at its longest still fits the engine\'s 20,000 byte limit, even with accents', async () => {
  const calls = installFetch();
  const max = { business: 200, name: 200, type: 0, website: 500, google: 500, instagram: 500, facebook: 500, fix: 2000, heard: 500, phone: 40, doWhat: 200, otherSocial: 500, likedSites: 1000, admired: 500, branding: 500, photos: 500 };
  const body = { ...GOOD, email: 'e'.repeat(240) + '@ex.com' };
  for (const [k, n] of Object.entries(max)) if (n) body[k] = 'é'.repeat(n);
  assert.ok(isThanks(await post(body)));
  const raw = toEngine(calls)[0].init.body;
  assert.ok(Buffer.byteLength(raw) < 20000, 'body is ' + Buffer.byteLength(raw) + ' bytes');
});

test('when the engine does not take it, the owner is emailed every answer under its label', async () => {
  const calls = installFetch({ engine: 500 });
  const res = await post({ ...GOOD, ...ALL_ANSWERS, fix: 'More calls' });
  assert.ok(isThanks(res));
  const mail = calls.find((c) => c.url.includes('api.resend.com'));
  assert.ok(mail, 'the email fallback ran');
  const text = JSON.parse(mail.init.body).text;
  for (const label of ['Type of business', 'Phone', 'What they do', 'Other social links', 'Sites they like', 'Businesses they admire or compete with', 'Branding', 'Photos link']) {
    assert.ok(text.includes(label + ': '), label);
  }
  for (const v of Object.values(ALL_ANSWERS)) assert.ok(text.includes(v), v);
  assert.ok(text.includes('Plumber'));
});

test('a send the engine takes does not also send an email', async () => {
  const calls = installFetch();
  await post({ ...GOOD });
  assert.equal(calls.some((c) => c.url.includes('api.resend.com')), false);
});

// The page itself.
const html = readFileSync(new URL('../start/index.html', import.meta.url), 'utf8');

test('the page offers the same 9 types, requires one, and has a field for every answer and the timing value', () => {
  const select = /<select id="type"([^>]*)>([\s\S]*?)<\/select>/.exec(html);
  assert.ok(select, 'type select');
  assert.match(select[1], /\brequired\b/);
  const options = [...select[2].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map((m) => ({ attrs: m[1], text: m[2].trim() }));
  assert.equal(options[0].text, 'Choose one');
  assert.match(options[0].attrs, /value=""/);
  assert.deepEqual(options.slice(1).map((o) => o.text), TYPES);
  for (const name of ['business', 'name', 'email', 'type', 'website', 'google', 'instagram', 'facebook', 'fix', 'heard', 'fax', 'ms', ...ANSWER_KEYS]) {
    assert.match(html, new RegExp('name="' + name + '"'), name);
  }
});

test('exactly four fields say Required, and the optional section is introduced once', () => {
  assert.equal((html.match(/<span class="req">Required<\/span>/g) || []).length, 4);
  assert.equal((html.match(/Anything you share here helps us prepare for our first call/g) || []).length, 1);
});

test('the timing value is filled in by script when the form is sent', () => {
  assert.match(html, /<input[^>]*type="hidden"[^>]*name="ms"|<input[^>]*name="ms"[^>]*type="hidden"/);
  assert.match(html, /getElementById\('ms'\)/);
  assert.match(html, /addEventListener\('submit'/);
});

test('no page text or server message uses an em dash or an en dash', () => {
  const server = readFileSync(new URL('../api/start.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /[–—]/);
  assert.doesNotMatch(server, /[–—]/);
});
