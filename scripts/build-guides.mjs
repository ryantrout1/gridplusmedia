// Turns content/guides/*.md into /guides/ pages and sitemap.xml. Runs on every Vercel deploy.
// The engine writes each guide as markdown with front matter (title, description, path, date,
// optional image and imageAlt), then one "# heading", the body, and "## question" answers.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { marked } from "marked";

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
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"')) v = JSON.parse(v);
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
    <div>&copy; 2026 Grid Pulse Media</div>
  </div>
</footer>
</body>
</html>
`;

const dateText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".md")) : [];
const guides = files.map(parse).sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));

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
  writeFileSync(`guides/${g.slug}/index.html`, `${head(`${g.heading} | Grid Pulse Media`, g.meta.description, path, ld)}<article class="wrap guide">
<p class="guide-crumb"><a href="/guides/">All guides</a></p>
<h1>${esc(g.heading)}</h1>
<p class="guide-date"><time datetime="${g.meta.date}">${dateText(g.meta.date)}</time></p>
${hero}<div class="guide-body">
${g.html}</div>
<aside class="guide-cta"><h2>Want this handled for you?</h2><p>We plan, write and publish your marketing every month, so none of it falls on you.</p><a class="btn" href="/start/">Get started</a></aside>
</article>
${foot}`);
}

const list = guides.length
  ? `<ul class="guide-list">\n${guides.map((g) => `<li><a href="/guides/${g.slug}/"><h2>${esc(g.heading)}</h2></a><p>${esc(g.meta.description)}</p><p class="guide-date"><time datetime="${g.meta.date}">${dateText(g.meta.date)}</time></p></li>`).join("\n")}\n</ul>`
  : `<p class="guide-empty">The first guides are on the way.</p>`;
writeFileSync("guides/index.html", `${head("Local Business Marketing Guides | Grid Pulse Media", "Plain-language guides for local business owners on getting found online, keeping listings matching and posting on a 90-day plan.", "/guides/")}<section class="wrap guide">
<h1>Guides</h1>
<p class="lede">Plain-language help for local business owners on getting found online and keeping your marketing going.</p>
${list}
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
function hub(dir, title, description, h1, lede, kind) {
  const items = pages.filter((p) => p.meta.kind === kind).map((p) => `<li><a href="/${p.slug}/"><h2>${esc(p.meta.h1 || p.heading)}</h2></a><p>${esc(p.meta.description)}</p></li>`).join("\n");
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, `${head(title, description, `/${dir}/`)}<section class="wrap guide">
<h1>${esc(h1)}</h1>
<p class="lede">${esc(lede)}</p>
<ul class="guide-list">
${items}
</ul>
</section>
${foot}`);
}
hub("services", "Marketing Services for Local Businesses | Grid Pulse Media", "What Grid Pulse Media does for local businesses: website, Google profile, social posts, listings, reviews and blog writing, on one monthly plan.", "Services", "Everything we run for a local business, on one monthly plan.", "service");
hub("faq", "Questions About Grid Pulse Media | FAQ", "Answers to common questions about pricing, the 90-day plan, who writes the content and how your Google listing is handled.", "Questions", "Straight answers about how Grid Pulse Media works.", "faq");

const urls = ["/", "/start/", "/guides/", ...guides.map((g) => `/guides/${g.slug}/`), "/services/", "/faq/", ...pages.map((p) => `/${p.slug}/`)];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${guides.length} guide(s) and ${pages.length} page(s).`);
