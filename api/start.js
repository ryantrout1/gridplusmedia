// Receives the /start form and sends it to the engine as a new lead (a signed POST to
// ENGINE_INTAKE_URL, signed with LEADS_INTAKE_SECRET, the same secret the engine holds).
// If the engine is not set up yet or does not answer, the form is emailed to the owner
// through Resend instead (RESEND_API_KEY and NOTIFY_TO), so a lead is never lost.
// TURNSTILE_SECRET is required: it turns on the Cloudflare Turnstile bot check, and without it every submission is refused.

import crypto from 'node:crypto';

// Key, label (used in the email fallback) and the longest value kept, the same limits the engine keeps.
// The order is the order of the payload sent to the engine. The last 7 are the optional answers; the
// engine keeps the same list (apps/engine/src/lib/leads/answers.ts in the miloe repo), so change both together.
const FIELDS = [
  ['business', 'Business', 200],
  ['name', 'Name', 200],
  ['email', 'Email', 254],
  ['type', 'Type of business', 200],
  ['website', 'Website', 500],
  ['google', 'Google business profile', 500],
  ['instagram', 'Instagram', 500],
  ['facebook', 'Facebook', 500],
  ['fix', 'Most wants fixed', 2000],
  ['heard', 'How they heard about us', 500],
  ['phone', 'Phone', 40],
  ['doWhat', 'What they do', 200],
  ['otherSocial', 'Other social links', 500],
  ['likedSites', 'Sites they like', 1000],
  ['admired', 'Businesses they admire or compete with', 500],
  ['branding', 'Branding', 500],
  ['photos', 'Photos link', 500],
];

// The types on the form. The engine maps each to an industry (apps/engine/src/lib/leads/derive.ts).
const TYPES = ['Esthetician or spa', 'Hair salon or barber', 'Plumber', 'Electrician', 'HVAC', 'Restaurant or food', 'Retail', 'Professional services', 'Something else'];

// The form measures, in the browser, how long the page was open before it was sent. A person needs
// more than this to fill in even the required fields; a script does not.
const MIN_FILL_MS = 3000;

// Junk filters (Miloe plan: block junk submissions). The audience is US only, so any
// letter outside the Latin script is refused in the typed fields, and business and name may not hold a link.
// The website, Google, Instagram and Facebook fields and the photos link are links by nature and are not checked.
const SCRIPT_CHECKED = ['business', 'name', 'type', 'fix', 'heard', 'phone', 'doWhat', 'otherSocial', 'likedSites', 'admired', 'branding'];
const FOREIGN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
const LINK = /:\/\/|\bwww\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/i;

// Every control character except tab and line break: a null breaks the save, and the rest only take up room.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(v, max = 2000) {
  return String(v == null ? '' : v).replace(/\r/g, '').replace(CONTROL, '').trim().slice(0, max);
}

// back: send the person to the page they just left (their answers are still in it) instead of a fresh form.
function page(status, message, back) {
  const link = back
    ? '<a href="/start/" onclick="history.back();return false" style="color:#B04A20">Go back to the form</a>'
    : '<a href="/start/" style="color:#B04A20">Back to the form</a>';
  return { status, html: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Grid Pulse Media</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#1E1B16;background:#F6F2EA"><h1 style="font-size:28px">' + message + '</h1><p>' + link + '</p></body>' };
}

// The timing value as whole milliseconds, or null when it is missing or not a whole number.
function fillTime(v) {
  const s = clean(v, 12);
  return /^\d{1,9}$/.test(s) ? Number(s) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const done = () => { res.setHeader('Location', '/start/thanks/'); return res.status(303).end(); };

  // Hidden trap field: real people leave it empty, bots fill it.
  if (clean(body.fax)) { return done(); }

  // Too quick for a person, or no timing at all: a friendly page and nothing sent, so a real person is not lost.
  // No timing usually means the page they sent from is older than this check, so they get a fresh form.
  const filled = fillTime(body.ms);
  if (filled === null) {
    const p = page(400, 'This page is out of date. Please reload the form and send it again.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }
  if (filled < MIN_FILL_MS) {
    const p = page(400, 'That went through too fast. Please go back and press Send again.', true);
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }

  const data = {};
  FIELDS.forEach(([key, , max]) => { data[key] = clean(body[key], max); });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if (!data.business || !data.name || !emailOk) {
    const p = page(400, 'Please add your business name, your name and a valid email.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }
  if (!TYPES.includes(data.type)) {
    const p = page(400, 'Please choose your type of business.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }

  const junk = [data.business, data.name].some((v) => LINK.test(v))
    || SCRIPT_CHECKED.some((key) => FOREIGN_SCRIPT.test(data[key]));
  if (junk) {
    const p = page(400, 'Please use English letters and numbers, and no web links in your business or name.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }

  // The bot check is required. With no secret set nothing is let through, so a missing
  // setting can never leave the form open.
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    console.error('TURNSTILE_SECRET is not set: refusing every submission');
    const p = page(500, 'Something went wrong on our end. Please try again soon.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }
  {
    const token = clean(body['cf-turnstile-response']);
    let ok = false;
    try {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }).toString(),
      });
      ok = !!token && v.ok && (await v.json()).success === true;
    } catch (e) {
      console.error('Turnstile check failed', e);
    }
    if (!ok) {
      const p = page(400, 'We could not confirm you are a person. Please go back and try again.');
      return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
    }
  }

  // First choice: the engine. Anything but a 2xx falls through to the email below.
  const engineUrl = process.env.ENGINE_INTAKE_URL || 'https://engine.miloe.ai/api/intake';
  const engineSecret = process.env.LEADS_INTAKE_SECRET;
  if (engineSecret) {
    try {
      const payload = JSON.stringify({ source: 'grid-pulse-media', ...data });
      const ts = String(Date.now());
      const sig = crypto.createHmac('sha256', engineSecret).update(ts + '.' + payload).digest('hex');
      const r = await fetch(engineUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Intake-Timestamp': ts, 'X-Intake-Signature': sig },
        body: payload,
      });
      if (r.ok) { return done(); }
      console.error('Engine intake answered', r.status);
    } catch (e) {
      console.error('Engine intake failed', e);
    }
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;
  if (!key || !to) {
    console.error('Lead not saved: the engine did not take it and Resend is not set up');
    const p = page(500, 'Something went wrong on our end. Please try again soon.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }

  const text = FIELDS.map(([k, label]) => label + ': ' + (data[k] || '(blank)')).join('\n\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Grid Pulse Media <onboarding@resend.dev>',
        to: [to],
        reply_to: data.email,
        subject: 'New request: ' + data.business,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      const p = page(502, 'Something went wrong on our end. Please try again soon.');
      return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
    }
  } catch (e) {
    console.error('Send failed', e);
    const p = page(502, 'Something went wrong on our end. Please try again soon.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }
  return done();
};
