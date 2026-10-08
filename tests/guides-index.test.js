// /guides/ is grouped by topic, and every guide page shows its time and links to related guides.
// Topic, minutes and keywords are optional front matter. A guide without them (the engine writes guides without them)
// still has to build, show up on /guides/ and get related links, so the fallback is tested with a fixture.
//
// Each build runs in its own temp folder, so this file never fights tests/services.test.js over the guides/ folder
// while node runs the test files side by side.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');
const DASH = new RegExp('[\\u2010-\\u2015\\u2212]');

// Build the site in a temp folder. With no fixture, the repo's own content is used.
const made = [];
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
function build(fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'gpm-guides-'));
  made.push(dir);
  symlinkSync(join(ROOT, 'scripts'), join(dir, 'scripts'), 'junction');
  if (!fixture) {
    symlinkSync(join(ROOT, 'content'), join(dir, 'content'), 'junction');
  } else {
    mkdirSync(join(dir, 'content', 'guides'), { recursive: true });
    for (const [name, text] of Object.entries(fixture)) writeFileSync(join(dir, 'content', 'guides', `${name}.md`), text);
  }
  const run = spawnSync('node', ['scripts/build-guides.mjs'], { cwd: dir, encoding: 'utf8' });
  return { dir, status: run.status, log: `${run.stdout}\n${run.stderr}`, read: (p) => readFileSync(join(dir, p), 'utf8') };
}

// The engine writes: title, description, path, date (unquoted), then the heading and body. Nothing else.
// Shape copied from apps/engine/src/lib/sites/article-file.ts in the miloe repo (formatArticle).
const engineGuide = (title, date, extra = []) => ['---', `title: ${JSON.stringify(title)}`, `description: ${JSON.stringify(`${title}, a short description.`)}`, `path: "/guides/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"`, `date: ${date}`, ...extra, '---', '', `# ${title}`, '', 'Body text.', ''].join('\n');
const classified = (title, date, topic, minutes) => engineGuide(title, date, [`topic: ${topic}`, ...(minutes ? [`minutes: ${minutes}`] : []), 'keywords: "gmb, google my business"']);

const FIXTURE = {
  'reviews-a': classified('Reviews A', '2026-10-08', 'reviews', 20),
  'reviews-b': classified('Reviews B', '2026-10-07', 'reviews', 60),
  'reviews-c': classified('Reviews C', '2026-10-06', 'reviews'),
  'reviews-d': classified('Reviews D', '2026-10-05', 'reviews', 15),
  'engine-shaped': engineGuide('Engine Shaped', '2026-10-04'),
  'typo-topic': classified('Typo Topic', '2026-10-03', 'revews', 10),
};

let cfg, repo, fx;
before(async () => {
  cfg = await import(pathToFileURL(join(ROOT, 'scripts', 'guide-config.mjs')).href);
  repo = build();
  fx = build(FIXTURE);
});

const front = (file) => {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  const o = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9]+):\s*(.*)$/.exec(line);
    if (kv) o[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return o;
};
const GUIDE_FILES = readdirSync('content/guides').filter((f) => f.endsWith('.md'));
const repoGuides = GUIDE_FILES.map((f) => ({ slug: f.replace(/\.md$/, ''), ...front(`content/guides/${f}`) }));

// The sections on /guides/: id, and the guide links inside each.
const sections = (html) => [...html.matchAll(/<section class="topic" id="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/section>/g)]
  .map((m) => ({ id: m[1], html: m[2], slugs: [...m[2].matchAll(/<li class="guide-card"><a href="\/guides\/([a-z0-9-]+)\/">/g)].map((x) => x[1]) }));
const related = (html) => {
  const m = /<nav class="guide-related"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (!m) return null;
  return { heading: /<h2[^>]*>([^<]*)<\/h2>/.exec(m[1])[1], slugs: [...m[1].matchAll(/<a href="\/guides\/([a-z0-9-]+)\/">/g)].map((x) => x[1]) };
};

test('every guide appears exactly once on /guides/', () => {
  const all = sections(repo.read('guides/index.html')).flatMap((s) => s.slugs);
  assert.deepEqual([...new Set(all)].sort(), repoGuides.map((g) => g.slug).sort());
  assert.equal(all.length, new Set(all).size, 'a guide is listed twice');
});

test('each guide sits in its own topic section, in the order set in the config, and empty topics are not shown', () => {
  const secs = sections(repo.read('guides/index.html'));
  const known = new Set(cfg.TOPICS.map((t) => t.id));
  for (const g of repoGuides) {
    const want = known.has(g.topic) ? g.topic : 'more';
    assert.ok(secs.find((s) => s.id === want)?.slugs.includes(g.slug), `${g.slug} should be in ${want}`);
  }
  const used = cfg.TOPICS.map((t) => t.id).filter((id) => repoGuides.some((g) => g.topic === id));
  assert.deepEqual(secs.map((s) => s.id).filter((id) => id !== 'more'), used);
  const anyLoose = repoGuides.some((g) => !known.has(g.topic));
  assert.equal(secs.some((s) => s.id === 'more'), anyLoose, 'More guides shows only when a guide has no known topic');
  if (secs.some((s) => s.id === 'more')) assert.equal(secs.at(-1).id, 'more', 'More guides comes last');
});

test('the index keeps its heading and its links to /services/ and /start/', () => {
  const html = repo.read('guides/index.html');
  assert.match(html, /<h1>Guides<\/h1>/);
  assert.match(html, /href="\/services\/"/);
  assert.match(html, /href="\/start\/"/);
});

test('a guide the engine wrote, with no topic or minutes, builds and lands under More guides, and a mistyped topic does too', () => {
  assert.equal(fx.status, 0, fx.log);
  const secs = sections(fx.read('guides/index.html'));
  assert.deepEqual(secs.find((s) => s.id === 'reviews').slugs, ['reviews-a', 'reviews-b', 'reviews-c', 'reviews-d'], 'newest first inside a topic');
  assert.deepEqual(secs.find((s) => s.id === 'more').slugs, ['engine-shaped', 'typo-topic']);
  assert.equal(secs.at(-1).id, 'more');
  for (const slug of Object.keys(FIXTURE)) assert.match(fx.read(`guides/${slug}/index.html`), /<h1>/, `${slug} has a page`);
});

test('the build says which guides have no topic, or a topic it does not know', () => {
  assert.match(fx.log, /engine-shaped/);
  assert.match(fx.log, /typo-topic[^\n]*revews/);
  assert.doesNotMatch(fx.log, /reviews-a/);
});

test('the sitemap still lists every guide', () => {
  const sitemap = repo.read('sitemap.xml');
  for (const g of repoGuides) assert.ok(sitemap.includes(`https://www.gridpulsemedia.com/guides/${g.slug}/`), g.slug);
});

test('timeLabel says how long in plain words', () => {
  const t = cfg.timeLabel;
  assert.equal(t(10), 'About 10 minutes');
  assert.equal(t(45), 'About 45 minutes');
  assert.equal(t(60), 'About an hour');
  assert.equal(t(90), 'About 90 minutes');
  assert.equal(t(120), 'About 2 hours');
  assert.equal(t(150), 'About 2 and a half hours');
  assert.equal(t(180), 'About 3 hours');
});

test('a guide with minutes shows its time under the date, and one without shows none', () => {
  assert.match(fx.read('guides/reviews-a/index.html'), /<p class="guide-date">[\s\S]*?<\/p>\n<p class="guide-meta">About 20 minutes<\/p>/);
  assert.match(fx.read('guides/reviews-b/index.html'), /<p class="guide-meta">About an hour<\/p>/);
  assert.doesNotMatch(fx.read('guides/reviews-c/index.html'), /guide-meta/);
  assert.doesNotMatch(fx.read('guides/engine-shaped/index.html'), /guide-meta/);
  for (const g of repoGuides.filter((x) => x.minutes)) {
    assert.ok(repo.read(`guides/${g.slug}/index.html`).includes(`<p class="guide-meta">${cfg.timeLabel(Number(g.minutes))}</p>`), g.slug);
  }
});

test('a guide ends with up to three more in its topic, newest first, never itself, before the call to action box', () => {
  const a = related(fx.read('guides/reviews-a/index.html'));
  assert.deepEqual(a, { heading: 'More in Reviews', slugs: ['reviews-b', 'reviews-c', 'reviews-d'] });
  assert.deepEqual(related(fx.read('guides/reviews-d/index.html')).slugs, ['reviews-a', 'reviews-b', 'reviews-c']);
  const html = fx.read('guides/reviews-b/index.html');
  assert.ok(html.indexOf('class="guide-related"') < html.indexOf('class="guide-cta"'));
  for (const g of repoGuides) {
    const r = related(repo.read(`guides/${g.slug}/index.html`));
    assert.ok(r, `${g.slug} has related links`);
    assert.ok(r.slugs.length >= 1 && r.slugs.length <= 3, `${g.slug} has 1 to 3 related links`);
    assert.ok(!r.slugs.includes(g.slug), `${g.slug} links to itself`);
    assert.equal(new Set(r.slugs).size, r.slugs.length);
  }
});

test('a guide with no topic gets the newest other guides instead', () => {
  assert.deepEqual(related(fx.read('guides/engine-shaped/index.html')), { heading: 'More guides', slugs: ['reviews-a', 'reviews-b', 'reviews-c'] });
  assert.deepEqual(related(fx.read('guides/typo-topic/index.html')).slugs, ['reviews-a', 'reviews-b', 'reviews-c']);
});

test('front matter on the real guides: topic is one the config knows, minutes is a whole number from 1 to 600, no dashes', (t) => {
  const known = new Set(cfg.TOPICS.map((x) => x.id));
  const loose = [];
  for (const g of repoGuides) {
    if (g.topic) assert.ok(known.has(g.topic), `${g.slug}: unknown topic "${g.topic}"`); else loose.push(g.slug);
    if (g.minutes) assert.ok(/^\d+$/.test(g.minutes) && Number(g.minutes) >= 1 && Number(g.minutes) <= 600, `${g.slug}: minutes "${g.minutes}"`);
    const raw = readFileSync(`content/guides/${g.slug}.md`, 'utf8').replace(/\r\n/g, '\n');
    assert.doesNotMatch(/^---\n([\s\S]*?)\n---/.exec(raw)[1], DASH, `${g.slug}: dash in front matter`);
  }
  if (loose.length) t.diagnostic(`No topic yet (listed under More guides): ${loose.join(', ')}`);
});

test('the config is sound: topic ids are unique, labels and blurbs have no dashes', () => {
  const ids = cfg.TOPICS.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const x of cfg.TOPICS) {
    assert.match(x.id, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(!['main', 'more', 'topics'].includes(x.id), `${x.id} is used by the page itself`);
    assert.ok(x.label && x.blurb, `${x.id} needs a label and a blurb`);
    assert.doesNotMatch(`${x.label} ${x.blurb}`, DASH);
  }
});
