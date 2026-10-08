// Turns content/guides/*.md into /guides/ pages and sitemap.xml. Runs on every Vercel deploy.
// The engine writes each guide as markdown with front matter (title, description, path, date,
// optional image and imageAlt), then one "# heading", the body, and "## question" answers.
// Optional lines the engine does not write yet: topic, minutes and keywords (see scripts/guide-config.mjs and the README).
// Learning paths (ordered guides, listed in PATHS in guide-config.mjs) get a page each at /guides/paths/<id>/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { marked } from "marked";
import { TOPICS, PATHS, timeLabel, pathLabel } from "./guide-config.mjs";

// www is the primary host: Vercel redirects the bare domain to it, so canonicals and the sitemap name www.
const SITE = "https://www.gridpulsemedia.com";
// Set to true to hide guides from search engines (the site launched Oct 5, 2026).
const NOINDEX = false;
const DIR = "content/guides";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parse(file, dir = DIR) {
  const raw = readFileSync(`${dir}/${file}`, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z0-9]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"')) {
      try { v = JSON.parse(v); } catch { throw new Error(`${dir}/${file}: ${kv[1]} is not valid quoted text (a quote inside it needs a backslash)`); }
    }
    meta[kv[1]] = v;
  }
  for (const k of dir === DIR ? ["title", "description", "date"] : ["title", "description"]) if (!meta[k]) throw new Error(`${file}: missing ${k}`);
  const slug = file.replace(/\.md$/, "");
  let body = m[2].trim();
  const h1 = /^#[ \t]+(.+)$/m.exec(body);
  const heading = h1 ? h1[1] : meta.title;
  if (h1) body = body.replace(h1[0], "").trim();
  return { slug, meta, heading, html: marked.parse(body) };
}

const head = (title, description, path, extra = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="msvalidate.01" content="0D943468C18944FF4F5E947928108EA3">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${NOINDEX ? '<meta name="robots" content="noindex">\n' : ""}<link rel="canonical" href="${SITE}${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@700&amp;family=Source+Sans+3:wght@400;600;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
${extra}<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/">
      <svg viewBox="160 168 680 680" aria-hidden="true"><rect x="205" y="220" width="275" height="260" rx="40" fill="#294634"/><rect x="512" y="220" width="270" height="260" rx="40" fill="#294634"/><rect x="205" y="543" width="275" height="254" rx="40" fill="#294634"/><rect x="512" y="543" width="270" height="254" rx="40" fill="#294634"/><path d="M205 512H340L372 462L430 622L496 365L560 604L634 468L662 512H793" fill="none" stroke="#F6F2EA" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/><path d="M205 512H340L372 462L430 622L496 365L560 604L634 468L662 512H793" fill="none" stroke="#BB5A23" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Grid Pulse Media</span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/#how">How it works</a>
      <a href="/#pricing">Pricing</a>
      <a href="/guides/">Guides</a>
      <a href="/#faq">Questions</a>
      <a class="btn btn-sm" href="/start/">Get started</a>
    </nav>
  </div>
</header>
<main id="main">
`;

const foot = `</main>
<footer class="site-footer">
  <div class="wrap foot-bar">
    <a class="brand" href="/">
      <svg viewBox="160 168 680 680" aria-hidden="true"><rect x="205" y="220" width="275" height="260" rx="40" fill="#294634"/><rect x="512" y="220" width="270" height="260" rx="40" fill="#294634"/><rect x="205" y="543" width="275" height="254" rx="40" fill="#294634"/><rect x="512" y="543" width="270" height="254" rx="40" fill="#294634"/><path d="M205 512H340L372 462L430 622L496 365L560 604L634 468L662 512H793" fill="none" stroke="#F6F2EA" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/><path d="M205 512H340L372 462L430 622L496 365L560 604L634 468L662 512H793" fill="none" stroke="#BB5A23" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Grid Pulse Media</span>
    </a>
    <a href="/services/">Services</a>
    <a href="/faq/">FAQ</a>
    <a href="/guides/">Guides</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
    <div>&copy; 2026 Grid Pulse Media</div>
  </div>
</footer>
</body>
</html>
`;

const dateText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".md")) : [];
// Newest first, then by title, so the order never depends on the file system.
const guides = files.map((f) => parse(f)).sort((a, b) => (a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : a.heading.localeCompare(b.heading)));

// /guides/paths/ is where the learning path pages live, so no guide can use that slug.
if (guides.some((g) => g.slug === "paths")) throw new Error('content/guides/paths.md cannot be used: /guides/paths/ is reserved for learning paths. Rename the guide.');

// topic, minutes and keywords are optional front matter. The engine writes guides without them, so a guide with no
// topic (or one the config does not know) is listed under "More guides" and named in the build log.
const TOPIC = new Map(TOPICS.map((t) => [t.id, t]));
for (const g of guides) {
  const t = g.meta.topic;
  g.topic = (t && TOPIC.get(t)) || null;
  if (!t) console.warn(`guide ${g.slug}: no topic, listed under More guides`);
  else if (!g.topic) console.warn(`guide ${g.slug}: topic "${t}" is not in scripts/guide-config.mjs, listed under More guides`);
  const m = g.meta.minutes;
  g.minutes = m && /^\d+$/.test(m) && Number(m) >= 1 && Number(m) <= 600 ? Number(m) : null;
  if (!g.minutes) console.warn(`guide ${g.slug}: ${m ? `minutes "${m}" is not a whole number from 1 to 600` : "no minutes"}, no time shown`);
}
// Up to three more from the same topic, otherwise the newest others.
function related(g) {
  const same = g.topic ? guides.filter((o) => o !== g && o.topic === g.topic).slice(0, 3) : [];
  if (same.length) return { heading: `More in ${g.topic.label}`, list: same };
  return { heading: "More guides", list: guides.filter((o) => o !== g).slice(0, 3) };
}
const relatedNav = (g) => {
  const r = related(g);
  return r.list.length ? `<nav class="guide-related" aria-labelledby="related-heading"><h2 id="related-heading">${esc(r.heading)}</h2><ul>${r.list.map((o) => `<li><a href="/guides/${o.slug}/">${esc(o.heading)}</a></li>`).join("")}</ul></nav>\n` : "";
};

// Learning paths. A slug with no guide, or a guide that already belongs to an earlier path, is left out and named in the log.
// A path with fewer than two steps left is not built. The total time shows only when every step has minutes.
const BY_SLUG = new Map(guides.map((g) => [g.slug, g]));
const paths = [];
for (const p of PATHS) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id) || paths.some((o) => o.id === p.id)) { console.warn(`path "${p.id}": not a usable id (letters, digits and hyphens, once), not built`); continue; }
  const steps = [];
  for (const slug of p.steps) {
    const g = BY_SLUG.get(slug);
    if (!g) console.warn(`path ${p.id}: no guide called ${slug}, left out`);
    else if (g.path) console.warn(`path ${p.id}: ${slug} is already in path ${g.path.path.id}, left out`);
    else if (steps.includes(g)) console.warn(`path ${p.id}: ${slug} is listed twice, left out`);
    else steps.push(g);
  }
  if (steps.length < 2) { console.warn(`path ${p.id}: ${steps.length} step${steps.length === 1 ? "" : "s"} left, not built (a path needs at least two)`); continue; }
  const built = { id: p.id, title: p.title, blurb: p.blurb, steps, label: pathLabel(steps.length, steps.every((g) => g.minutes) ? steps.reduce((n, g) => n + g.minutes, 0) : null) };
  steps.forEach((g, index) => { g.path = { path: built, index }; });
  paths.push(built);
}
// On a guide in a path: the "Step 2 of 6 in ..." line under the title, and Previous / Next at the end (the last step links back to the path page).
const stepLine = (g) => (g.path ? `<p class="guide-path"><a href="/guides/paths/${g.path.path.id}/">Step ${g.path.index + 1} of ${g.path.path.steps.length} in ${esc(g.path.path.title)}</a></p>\n` : "");
function pathNav(g) {
  if (!g.path) return "";
  const { path: p, index: i } = g.path;
  const link = (cls, href, word, text) => `<li class="${cls}"><a href="${href}"><span>${word}</span> ${esc(text)}</a></li>`;
  const prev = p.steps[i - 1];
  const next = p.steps[i + 1];
  return `<nav class="guide-path-nav" aria-labelledby="path-nav-heading"><h2 id="path-nav-heading">Step ${i + 1} of ${p.steps.length}: ${esc(p.title)}</h2><ul>${prev ? link("prev", `/guides/${prev.slug}/`, "Previous", prev.heading) : ""}${next ? link("next", `/guides/${next.slug}/`, "Next", next.heading) : link("next done", `/guides/paths/${p.id}/`, "Finished", "Back to the whole path")}</ul></nav>\n`;
}

rmSync("guides", { recursive: true, force: true });
mkdirSync("guides", { recursive: true });

for (const g of guides) {
  const path = `/guides/${g.slug}/`;
  const ld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Article", headline: g.heading, description: g.meta.description,
    datePublished: g.meta.date, ...(g.meta.image ? { image: SITE + g.meta.image } : {}),
    author: { "@type": "Organization", name: "Grid Pulse Media" }, publisher: { "@type": "Organization", name: "Grid Pulse Media" },
    mainEntityOfPage: SITE + path,
  }).replace(/</g, "\\u003c")}</script>\n`;
  const hero = g.meta.image ? `<img class="guide-hero" src="${esc(g.meta.image)}" alt="${esc(g.meta.imageAlt || "")}" width="1200" height="630">\n` : "";
  mkdirSync(`guides${path.slice(7)}`, { recursive: true });
  writeFileSync(`guides/${g.slug}/index.html`, `${head(g.meta.seoTitle || `${g.heading} | Grid Pulse Media`, g.meta.description, path, ld)}<article class="wrap guide">
<p class="guide-crumb"><a href="/guides/">All guides</a></p>
<h1>${esc(g.heading)}</h1>
<p class="guide-date"><time datetime="${g.meta.date}">${dateText(g.meta.date)}</time></p>
${g.minutes ? `<p class="guide-meta">${timeLabel(g.minutes)}</p>\n` : ""}${stepLine(g)}${hero}<div class="guide-body">
${g.html}</div>
${pathNav(g)}${relatedNav(g)}<aside class="guide-cta"><h2>Want this handled for you?</h2><p>We plan, write and publish your marketing every month, so none of it falls on you.</p><a class="btn" href="/start/">Get started</a></aside>
</article>
${foot}`);
}

// One page per learning path: what it is, the steps in order with the time each takes, and a button to start.
const pathStep = (g) => `<li class="path-step"><a href="/guides/${g.slug}/"><h2>${esc(g.heading)}</h2></a><p>${esc(g.meta.description)}</p>${g.minutes ? `<p class="guide-meta">${timeLabel(g.minutes)}</p>` : ""}</li>`;
for (const p of paths) {
  mkdirSync(`guides/paths/${p.id}`, { recursive: true });
  writeFileSync(`guides/paths/${p.id}/index.html`, `${head(`${p.title} | Grid Pulse Media`, `${p.blurb} A step by step path: ${p.label}.`, `/guides/paths/${p.id}/`)}<section class="wrap guide guide-path-page">
<p class="guide-crumb"><a href="/guides/">All guides</a></p>
<h1>${esc(p.title)}</h1>
<p class="lede">${esc(p.blurb)}</p>
<p class="guide-meta">${esc(p.label)}</p>
<ol class="path-steps">
${p.steps.map(pathStep).join("\n")}
</ol>
<p class="path-start"><a class="btn" href="/guides/${p.steps[0].slug}/">Start with step 1</a></p>
<aside class="guide-cta"><h2>Want this handled for you?</h2><p>We plan, write and publish your marketing every month, so none of it falls on you.</p><a class="btn" href="/start/">Get started</a></aside>
</section>
${foot}`);
}

// The Start here row on /guides/: one card per path.
const pathCard = (p) => `<li class="path-card"><a href="/guides/paths/${p.id}/"><h3>${esc(p.title)}</h3></a><p>${esc(p.blurb)}</p><p class="guide-meta">${esc(p.label)}</p></li>`;
const startHere = paths.length ? `<section class="start-here" id="start" aria-labelledby="start-heading">\n<h2 id="start-heading">Start here</h2>\n<p class="topic-blurb">Not sure where to begin? Pick one and follow it, one step at a time.</p>\n<ul class="path-cards">\n${paths.map(pathCard).join("\n")}\n</ul>\n</section>\n` : "";

// One section per topic, in the order set in guide-config.mjs. Guides with no known topic go last under "More guides".
const card = (g) => `<li class="guide-card"><a href="/guides/${g.slug}/"><h3>${esc(g.heading)}</h3></a><p>${esc(g.meta.description)}</p>${g.minutes ? `<p class="guide-meta">${timeLabel(g.minutes)}</p>` : ""}</li>`;
const topicSection = (id, label, blurb, items) => `<section class="topic" id="${id}">\n<h2>${esc(label)}</h2>\n<p class="topic-blurb">${esc(blurb)}</p>\n<ul class="guide-cards">\n${items.map(card).join("\n")}\n</ul>\n</section>`;
const groups = [
  ...TOPICS.map((t) => ({ id: t.id, label: t.label, blurb: t.blurb, items: guides.filter((g) => g.topic === t) })),
  { id: "more", label: "More guides", blurb: "Newer guides that have not been sorted into a topic yet.", items: guides.filter((g) => !g.topic) },
].filter((s) => s.items.length);
const list = guides.length
  ? `<div class="topics">\n${groups.map((s) => topicSection(s.id, s.label, s.blurb, s.items)).join("\n")}\n</div>`
  : `<p class="guide-empty">The first guides are on the way.</p>`;
writeFileSync("guides/index.html", `${head("Local Business Marketing Guides | Grid Pulse Media", "Plain-language guides for local business owners on getting found online, keeping listings matching and posting on a 90-day plan.", "/guides/")}<section class="wrap guide guide-index">
<h1>Guides</h1>
<p class="lede">Plain-language help for local business owners on getting found online and keeping your marketing going.</p>
<div class="guide-body"><p>These guides cover the everyday parts of marketing a local business: setting up and keeping your Google Business Profile accurate, getting found when customers search nearby, asking for and answering reviews, deciding how often to post, and knowing what to write on your blog. Each one is written for owners who are short on time, with plain steps you can act on this week.</p><p>If you would rather not do any of it yourself, Grid Pulse Media plans, writes and posts all of this for you on a 90-day plan. See <a href="/services/">what we run for you</a> or <a href="/start/">get started</a>.</p></div>
${startHere}${list}
</section>
${foot}`);

// Service and FAQ pages the engine drafts: content/pages/<slug>.md becomes /<slug>/, with /services/ and /faq/ listing them.
const PDIR = "content/pages";
const pages = (existsSync(PDIR) ? readdirSync(PDIR).filter((f) => f.endsWith(".md")) : []).map((f) => parse(f, PDIR));
const withBrand = (t) => (/Grid Pulse Media/.test(t) ? t : `${t} | Grid Pulse Media`);
for (const pg of pages) {
  const path = `/${pg.slug}/`;
  let faqs = [];
  try { faqs = JSON.parse(pg.meta.faqs || "[]"); } catch { faqs = []; }
  const ld = faqs.length ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  }).replace(/</g, "\\u003c")}</script>\n` : "";
  mkdirSync(pg.slug, { recursive: true });
  writeFileSync(`${pg.slug}/index.html`, `${head(withBrand(pg.meta.title), pg.meta.description, path, ld)}<article class="wrap guide">
<h1>${esc(pg.meta.h1 || pg.heading)}</h1>
<div class="guide-body">
${pg.html}</div>
<aside class="guide-cta"><h2>Want this handled for you?</h2><p>We plan, write and publish your marketing every month, so none of it falls on you.</p><a class="btn" href="/start/">Get started</a></aside>
</article>
${foot}`);
}

// Privacy and terms: content/legal/<slug>.md becomes /<slug>/ (no call-to-action box, no guide date).
const LDIR = "content/legal";
const legal = (existsSync(LDIR) ? readdirSync(LDIR).filter((f) => f.endsWith(".md")) : []).map((f) => parse(f, LDIR));
for (const lg of legal) {
  mkdirSync(lg.slug, { recursive: true });
  writeFileSync(`${lg.slug}/index.html`, `${head(lg.meta.title, lg.meta.description, `/${lg.slug}/`)}<article class="wrap guide">
<h1>${esc(lg.heading)}</h1>
<div class="guide-body">
${lg.html}</div>
</article>
${foot}`);
}
// A page for one kind of business (electrician-marketing-service) says what the main plan says, and a few pages cover the
// same ground as another service. They stay published and linked, but /services/ shows them as short rows of links under the
// list instead of repeating them as entries. The engine drafts new pages, so the trade rule is a pattern, not a list.
const BY_TYPE = /^[a-z]+-marketing-service$/;
const RELATED = new Set(["listing-consistency-service", "website-social-posting-service"]);
const entry = (p) => `<li><a href="/${p.slug}/"><h2>${esc(p.meta.h1 || p.heading)}</h2></a><p>${esc(p.meta.description)}</p></li>`;
const linkRow = (head, list) => (list.length ? `<h2 class="more-head">${head}</h2>\n<ul class="link-row">\n${list.map((p) => `<li><a href="/${p.slug}/">${esc(p.meta.h1 || p.heading)}</a></li>`).join("\n")}\n</ul>\n` : "");
function hub(dir, title, description, h1, lede, kind, intro = "") {
  const all = pages.filter((p) => p.meta.kind === kind);
  const group = (p) => (kind !== "service" ? "main" : BY_TYPE.test(p.slug) ? "type" : RELATED.has(p.slug) ? "related" : "main");
  const items = all.filter((p) => group(p) === "main").map(entry).join("\n");
  const more = linkRow("For your type of business", all.filter((p) => group(p) === "type")) + linkRow("Related", all.filter((p) => group(p) === "related"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, `${head(title, description, `/${dir}/`)}<section class="wrap guide">
<h1>${esc(h1)}</h1>
<p class="lede">${esc(lede)}</p>
${intro}
<ul class="guide-list">
${items}
</ul>
${more}</section>
${foot}`);
}
hub("services", "Marketing Services for Local Businesses | Grid Pulse Media", "What Grid Pulse Media does for local businesses: website, Google profile, social posts, listings, reviews and blog writing, on one monthly plan.", "Services", "Everything we run for a local business, on one monthly plan.", "service");
hub("faq", "Questions About Grid Pulse Media | FAQ", "Answers to common questions about pricing, the 90-day plan, who writes the content and how your Google listing is handled.", "Questions", "Straight answers about how Grid Pulse Media works.", "faq", `<div class="guide-body"><p>Most owners ask the same few things before they start: what it costs, what is included in the 90-day plan, who writes the content, how often we post, and how we look after your Google listing. Each page below answers one of those in plain language.</p><p>The short version: Grid Pulse Media runs the digital side of your business for one monthly price. We plan your marketing in 90-day stretches, write and publish the posts, keep your website, Google profile and listings matching, and answer reviews and comments in your voice. If your question is not here, ask it on the <a href="/start/">Get started</a> form and we will answer it before your setup call.</p><p>For reference, it is $349 per month plus a one-time setup fee of $699, with a three-month minimum and month to month after that. Your website is yours to keep. Every answer here describes how we actually work, so nothing is promised that we cannot deliver, and if something changes we update the page.</p></div>`);

const urls = ["/", "/start/", "/guides/", ...guides.map((g) => `/guides/${g.slug}/`), ...paths.map((p) => `/guides/paths/${p.id}/`), "/services/", "/faq/", ...pages.map((p) => `/${p.slug}/`), ...legal.map((l) => `/${l.slug}/`)];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${guides.length} guide(s), ${pages.length} page(s) and ${legal.length} legal page(s).`);
