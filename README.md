# Grid Pulse Media

Static site, no build step. Hosted on Vercel, deployed from this repo. `main` is production (gridpulsemedia.com).

## Open items

None on the page right now. Terms in use: three-month minimum, then month to month; website is the client's to keep.

Pricing on the page: $349 per month, $699 one-time setup.

## Before search engines should see it

- Fill the open items above.
- Remove the `noindex` meta tag from `index.html`.

## Get started form

Every call-to-action goes to `/start/`. The form posts to `api/start.js`, which emails the answers through Resend. Set two environment variables in Vercel (Production and Preview):

- `RESEND_API_KEY`: a Resend API key.
- `NOTIFY_TO`: the email that receives submissions. With Resend's test sender this must be the email the Resend account was created with.

You then email the person a scheduling link by hand.

## Bot check (Cloudflare Turnstile)

Create a free Turnstile widget in Cloudflare for gridpulsemedia.com. Put the site key in `TURNSTILE_SITE_KEY` in `start/index.html`, and set `TURNSTILE_SECRET` in Vercel. Until both are set, only the hidden trap field protects the form.
