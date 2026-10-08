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

## Form fields and bot checks

Four fields are required: business, name, email and type of business. Everything else is optional and helps prepare the first call. The list of types and the 7 optional answers (`phone`, `doWhat`, `otherSocial`, `likedSites`, `admired`, `branding`, `photos`) live in `api/start.js`, and the engine keeps the same lists (`derive.ts` and `answers.ts` under `apps/engine/src/lib/leads/` in the miloe repo). Change both together, engine first, or answers are dropped.

Bot checks, in order: the hidden `fax` field (a quiet thank-you), a timing check (the page fills in `ms`, how long it was open; under 3 seconds gets a retry page and nothing is sent), then Turnstile.

## Tests

`node --test` runs `tests/start.test.js` against the form's server code and page. It needs no packages.

## Service and FAQ pages

The engine drafts service and FAQ pages; each approved one is a markdown file in `content/pages/<slug>.md` (title, description, kind, h1, faqs as front matter). `scripts/build-guides.mjs` writes it to `/<slug>/` with FAQ structured data, builds `/services/` and `/faq/` lists, and adds all of them to `sitemap.xml`. Generated folders are in `.gitignore`: add a new slug there when adding a page.

## Privacy and terms

`content/legal/privacy.md` and `content/legal/terms.md` become `/privacy/` and `/terms/` on every deploy (same build script) and are in the sitemap. Footer links to both are on every page. Edit the markdown to change the wording. Add a new slug to `.gitignore` if you add another file there.

## Guides

`/guides/` is built from markdown. Each file in `content/guides/` becomes a page; `scripts/build-guides.mjs`
runs on every Vercel deploy (see `vercel.json`) and writes `/guides/` pages and `sitemap.xml`. The generated
files are not committed. The engine publishes a guide by committing a `.md` file there (and its picture to
`images/guides/`), which triggers a deploy. Guides carry `noindex` only if the `NOINDEX` constant in the build script is `true` (it is `false` now).

`/guides/` is grouped by topic, and each guide page shows its time and links to more in its topic. Two optional front matter lines drive that, and a third feeds search:

- `topic: reviews` is one of the ids in `scripts/guide-config.mjs` (`TOPICS`, which also sets the order and wording of the sections).
- `minutes: 20` is a whole number, about how long the guide takes to read and do. Only put a time the guide itself states.
- `keywords: "gmb, google my business"` is words an owner might type that the guide does not use.

The engine writes guides without these lines (it writes title, description, path, date). Such a guide still builds and shows up under "More guides" at the bottom of `/guides/`, and the build log names it. Set `topic` and `minutes` on it to move it into place. Do not use a front matter key called `path` for anything new: the engine already writes it as the guide's URL. To add a topic, add one entry to `TOPICS`. `tests/guides-index.test.js` checks every guide is listed once and that the fallback works.

Learning paths are ordered sets of guides, each with a page at `/guides/paths/<id>/` and a card in the "Start here" row on `/guides/`. They are listed in `PATHS` in `scripts/guide-config.mjs`: an id, a title, a one line blurb and the guide slugs in order. A guide in a path shows "Step 2 of 6 in ..." under its title and Previous / Next at the end. The time on a path is the sum of its guides' `minutes`, so every guide in a path needs `minutes`. If one has none, the path still builds but shows only the number of steps, and the build log names the guide. A guide can be in one path only. A new guide does not have to be in a path; to add it to one, add its slug to that path's `steps`. A slug that has no guide, or a guide already in an earlier path, is left out and named in the build log, and a path with fewer than two steps left is not built. No guide can be named `paths` (the build stops and says so), because `/guides/paths/` is where the path pages live.

Search and filters on `/guides/`: a search box, time chips ("up to" 15 minutes, an hour, an afternoon) and topic chips sit under the intro. The page script `guides.js` runs them and the matching rules are in `guides-filter.js`, both at the site root, loaded on `/guides/` only. The controls ship with the `hidden` attribute and the script shows them, so with JavaScript off nobody sees buttons that do nothing and every guide stays listed. Every word typed has to match the start of a word in a guide's title, description, topic name or `keywords`, so `keywords` is where to put the words owners use that the guide does not (`gmb`). A time chip hides guides that have no `minutes`. The time chips are `TIME_CHIPS` and the short topic chip names are the `short` field of each topic, both in `scripts/guide-config.mjs`. A new topic or guide needs no change to the script. The filter is not kept in the address bar and nothing the visitor types is recorded. `tests/guides-filter.test.js` checks the rules.

## The services page

`/services/` lists each distinct service once. A page for one kind of business (`<trade>-marketing-service`, such as `electrician-marketing-service`) and the pages named in `RELATED` in `scripts/build-guides.mjs` stay published but appear as short link rows under the list, because they say what a main service already says. A new trade page the engine drafts is grouped by its slug. `tests/services.test.js` fails if two main entries read as the same service or a page is left unlinked.
