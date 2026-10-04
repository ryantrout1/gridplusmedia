// Receives the /start form and emails it to the owner through Resend.
// Needs two environment variables in Vercel: RESEND_API_KEY and NOTIFY_TO.
// Optional: TURNSTILE_SECRET turns on the Cloudflare Turnstile bot check.

const FIELDS = [
  ['business', 'Business'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['type', 'Type of business'],
  ['website', 'Website'],
  ['google', 'Google business profile'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['fix', 'Most wants fixed'],
  ['heard', 'How they heard about us'],
];

function clean(v) {
  return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, 2000);
}

function page(status, message) {
  return { status, html: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Grid Pulse Media</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#1E1B16;background:#F6F2EA"><h1 style="font-size:28px">' + message + '</h1><p><a href="/start/" style="color:#B04A20">Back to the form</a></p></body>' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const done = () => { res.setHeader('Location', '/start/thanks/'); return res.status(303).end(); };

  // Hidden trap field: real people leave it empty, bots fill it.
  if (clean(body.fax)) { return done(); }

  const data = {};
  FIELDS.forEach(([key]) => { data[key] = clean(body[key]); });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if (!data.business || !data.name || !emailOk) {
    const p = page(400, 'Please add your business name, your name and a valid email.');
    return res.status(p.status).setHeader('Content-Type', 'text/html; charset=utf-8').send(p.html);
  }

  const secret = process.env.TURNSTILE_SECRET;
  if (secret) {
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

  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;
  if (!key || !to) {
    console.error('Missing RESEND_API_KEY or NOTIFY_TO');
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
