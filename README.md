# Grid Pulse Media

Static site, no build step. Hosted on Vercel, deployed from this repo. `main` is production (gridpulsemedia.com).

## Open items

None on the page right now. Terms in use: three-month minimum, then month to month; website is the client's to keep.

Pricing on the page: $349 per month, $699 one-time setup.

## Search engines

Launched Oct 5, 2026: the `noindex` tags are removed from the home page, `/start/` and the guides. Only `/start/thanks/` keeps `noindex` on purpose. `www.gridpulsemedia.com` is the primary host (Vercel redirects the bare domain to it), so canonicals and the sitemap use www. `robots.txt` allows everything and points to the sitemap. To hide the site again, put the `noindex` tag back in `index.html` and `start/index.html` and set `NOINDEX = true` in the build script.

## Get started form

Every call-to-action goes to `/start/`. The form posts to `api/start.js`, which emails the answers through Resend. Set two environment variables in Vercel (Production and Preview):

- `RESEND_API_KEY`: a Resend API key.
- `NOTIFY_TO`: the email that receives submissions. With Resend's test sender this must be the email the Resend account was created with.

You then email the person a scheduling link by hand.

## Bot check (Cloudflare Turnstile)

Create a free Turnstile widget in Cloudflare for gridpulsemedia.com. Put the site key in `TURNSTILE_SITE_KEY` in `start/index.html`, and set `TURNSTILE_SECRET` in Vercel. Until both are set, only the hidden trap field protects the form.

## Where the form goes

`api/start.js` sends each submission to the engine as a lead: a signed POST to `ENGINE_INTAKE_URL`
(default `https://engine.miloe.ai/api/intake`). It signs the body with `LEADS_INTAKE_SECRET`, which must be
the same value the engine project has. Until that variable is set, or if the engine does not answer, the
form is emailed through Resend instead (`RESEND_API_KEY`, `NOTIFY_TO`), so a lead is not lost. If neither
works the visitor sees an error rather than a thank-you.

## Service and FAQ pages

The engine drafts service and FAQ pages; each approved one is a markdown file in `content/pages/<slug>.md` (title, description, kind, h1, faqs as front matter). `scripts/build-guides.mjs` writes it to `/<slug>/` with FAQ structured data, builds `/services/` and `/faq/` lists, and adds all of them to `sitemap.xml`. Generated folders are in `.gitignore`: add a new slug there when adding a page.

## Guides

`/guides/` is built from markdown. Each file in `content/guides/` becomes a page; `scripts/build-guides.mjs`
runs on every Vercel deploy (see `vercel.json`) and writes `/guides/` pages and `sitemap.xml`. The generated
files are not committed. The engine publishes a guide by committing a `.md` file there (and its picture to
`images/guides/`), which triggers a deploy. Guides carry `noindex` only if the `NOINDEX` constant in the build script is `true` (it is `false` now).
