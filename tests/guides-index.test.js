// /guides/ is grouped by topic, and every guide page shows its time and links to related guides.
// Topic, minutes and keywords are optional front matter. A guide without them (the engine writes guides without them)
// still has to build, show up on /guides/ and get related links, so the fallback is tested with a fixture.
//
// The search box and chips on /guides/ ship hidden and only appear when the page script runs, so that markup is checked here too
// (the filter itself is in tests/guides-filter.test.js). Learning paths (ordered guides with a page of their own) are tested here too: the real config against the real guides,
// and a fixture with its own PATHS for the cases the real ones do not have (a missing slug, a guide in two paths).
//
// Each build runs in its own temp folder, so this file never fights tests/services.test.js over the guides/ folder
// while node runs the test files side by side.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, readdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');
const DASH = new RegExp('[\\u2010-\\u2015\\u2212]');

// Build the site in a temp folder. With no fixture, the repo's own content is used. With paths, the build script runs from
// its own copy next to a config that has those PATHS (and the real topics), so a fixture can have paths made of fixture guides.
const made = [];
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
function build(fixture, paths) {
  const dir = mkdtempSync(join(tmpdir(), 'gpm-guides-'));
  made.push(dir);
  if (paths) {
    mkdirSync(join(dir, 'scripts'));
    copyFileSync(join(ROOT, 'scripts', 'build-guides.mjs'), join(dir, 'scripts', 'build-guides.mjs'));
    const real = JSON.stringify(pathToFileURL(join(ROOT, 'scripts', 'guide-config.mjs')).href);
    writeFileSync(join(dir, 'scripts', 'guide-config.mjs'), `export { TOPICS, TIME_CHIPS, timeLabel, pathLabel } from ${real};\nexport const PATHS = ${JSON.stringify(paths)};\n`);
    symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'junction');
  } else {
    symlinkSync(join(ROOT, 'scripts'), join(dir, 'scripts'), 'junction');
  }
  if (!fixture) {
    symlinkSync(join(ROOT, 'content'), join(dir, 'content'), 'junction');
  } else {
    mkdirSync(join(dir, 'content', 'guides'), { recursive: true });
    for (const [name, text] of Object.entries(fixture)) writeFileSync(join(dir, 'content', 'guides', `${name}.md`), text);
  }
  const run = spawnSync('node', ['scripts/build-guides.mjs'], { cwd: dir, encoding: 'utf8' });
  return { dir, status: run.status, log: `${run.stdout}\n${run.stderr}`, read: (p) => readFileSync(join(dir, p), 'utf8'), has: (p) => existsSync(join(dir, p)) };
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
  'measure-a': classified('Measure A', '2026-10-02', 'measure', 25),
  'measure-b': classified('Measure B', '2026-10-01', 'measure'),
  'measure-c': classified('Measure C', '2026-09-30', 'measure', 5),
};

// Paths for the fixture guides. habit is whole. ghost lists a guide that does not exist and one guide twice. dup shares a guide
// with habit. mixed has one step with minutes and one without. The last two cannot be built: an id that is not a folder name,
// and an id already taken (their steps are free, so only the id check stops them).
const PATHS_FIXTURE = [
  { id: 'habit', title: 'Build a habit', blurb: 'Three guides, in order.', steps: ['reviews-a', 'reviews-b', 'reviews-d'] },
  { id: 'ghost', title: 'Ghost path', blurb: 'One step is missing.', steps: ['reviews-c', 'reviews-c', 'no-such-guide', 'engine-shaped'] },
  { id: 'dup', title: 'Dup path', blurb: 'Shares a guide with habit.', steps: ['reviews-a', 'typo-topic'] },
  { id: 'mixed', title: 'Mixed times', blurb: 'One step has no minutes.', steps: ['measure-a', 'measure-b'] },
  { id: 'Bad Id', title: 'Bad id', blurb: 'The id cannot be a folder name.', steps: ['typo-topic', 'measure-c'] },
  { id: 'mixed', title: 'Same id again', blurb: 'Reuses an id.', steps: ['typo-topic', 'measure-c'] },
];

let cfg, repo, fx, px, reserved;
before(async () => {
  cfg = await import(pathToFileURL(join(ROOT, 'scripts', 'guide-config.mjs')).href);
  repo = build();
  fx = build(FIXTURE);
  px = build(FIXTURE, PATHS_FIXTURE);
  reserved = build({ paths: engineGuide('Paths', '2026-10-08') });
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
  .map((m) => ({ id: m[1], html: m[2], slugs: [...m[2].matchAll(/<li class="guide-card"[^>]*><a href="\/guides\/([a-z0-9-]+)\/">/g)].map((x) => x[1]) }));
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
    assert.ok(!['main', 'more', 'topics', 'start'].includes(x.id), `${x.id} is used by the page itself`);
    assert.ok(x.label && x.blurb, `${x.id} needs a label and a blurb`);
    assert.doesNotMatch(`${x.label} ${x.blurb}`, DASH);
  }
});

// ---- Learning paths ----

// The path page: heading, the "3 steps, about 95 minutes" line, the steps in order with their time, the Start button.
const pathPage = (html) => ({
  title: /<h1>([^<]*)<\/h1>/.exec(html)?.[1],
  label: /<p class="guide-meta">([^<]*)<\/p>\s*<ol class="path-steps">/.exec(html)?.[1],
  steps: [...html.matchAll(/<li class="path-step">([\s\S]*?)<\/li>/g)].map((m) => ({ slug: /href="\/guides\/([a-z0-9-]+)\/"/.exec(m[1])?.[1], time: /<p class="guide-meta">([^<]*)<\/p>/.exec(m[1])?.[1] ?? null })),
  start: /<p class="path-start"><a class="btn" href="([^"]+)">([^<]*)<\/a>/.exec(html)?.slice(1),
});
// The Start here row on /guides/.
const startRow = (html) => {
  const m = /<section class="start-here"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  if (!m) return null;
  return [...m[1].matchAll(/<li class="path-card"><a href="\/guides\/paths\/([a-z0-9-]+)\/"><h3>([^<]*)<\/h3><\/a><p>([^<]*)<\/p><p class="guide-meta">([^<]*)<\/p><\/li>/g)]
    .map((c) => ({ id: c[1], title: c[2], blurb: c[3], label: c[4] }));
};
// What a guide in a path shows: the "Step 2 of 6 in ..." line under the title and the Previous / Next pair at the end.
const stepLine = (html) => { const m = /<p class="guide-path"><a href="([^"]+)">([^<]*)<\/a><\/p>/.exec(html); return m ? { href: m[1], text: m[2] } : null; };
const pathNav = (html) => {
  const m = /<nav class="guide-path-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (!m) return null;
  return { prev: /<li class="prev"><a href="([^"]+)"/.exec(m[1])?.[1] ?? null, next: /<li class="next(?: done)?"><a href="([^"]+)"/.exec(m[1])?.[1] ?? null, done: /<li class="next done">/.test(m[1]) };
};
const minutesOf = (slug) => Number(repoGuides.find((g) => g.slug === slug).minutes);

test('pathLabel says how many steps and about how long, in plain words', () => {
  const l = cfg.pathLabel;
  assert.equal(l(6, 180), '6 steps, about 3 hours');
  assert.equal(l(3, 55), '3 steps, about 55 minutes');
  assert.equal(l(2, 60), '2 steps, about an hour');
  assert.equal(l(4, 150), '4 steps, about 2 and a half hours');
  assert.equal(l(3, null), '3 steps');
});

test('the paths in the config are sound: known guides with minutes, none in two paths, plain wording', () => {
  assert.ok(Array.isArray(cfg.PATHS));
  for (const id of ['get-found', 'review-habit', 'posting-habit', 'before-you-hire']) assert.ok(cfg.PATHS.some((p) => p.id === id), `path ${id} is missing`);
  const ids = cfg.PATHS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'a path id is used twice');
  const slugs = new Set(repoGuides.map((g) => g.slug));
  const inPath = new Map();
  for (const p of cfg.PATHS) {
    assert.match(p.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(p.title && p.blurb, `${p.id} needs a title and a blurb`);
    assert.doesNotMatch(`${p.title} ${p.blurb}`, DASH, `${p.id}: dash in wording`);
    assert.ok(p.steps.length >= 2, `${p.id} needs at least two steps`);
    for (const s of p.steps) {
      assert.ok(slugs.has(s), `${p.id}: no guide called ${s}`);
      assert.ok(!inPath.has(s), `${s} is in both ${inPath.get(s)} and ${p.id}`);
      inPath.set(s, p.id);
      assert.ok(repoGuides.find((g) => g.slug === s).minutes, `${s} is in a path, so it needs minutes`);
    }
  }
});

test('every real path has a page: steps in order, a time for each, and a total that is the sum', () => {
  for (const p of cfg.PATHS) {
    const page = pathPage(repo.read(`guides/paths/${p.id}/index.html`));
    assert.equal(page.title, p.title);
    assert.deepEqual(page.steps.map((s) => s.slug), p.steps);
    assert.deepEqual(page.steps.map((s) => s.time), p.steps.map((s) => cfg.timeLabel(minutesOf(s))));
    assert.equal(page.label, cfg.pathLabel(p.steps.length, p.steps.reduce((n, s) => n + minutesOf(s), 0)));
    assert.deepEqual(page.start, [`/guides/${p.steps[0]}/`, 'Start with step 1']);
    assert.match(repo.read(`guides/paths/${p.id}/index.html`), /class="guide-cta"/);
  }
});

test('/guides/ opens with a Start here row: one card per path, above the topic sections', () => {
  const html = repo.read('guides/index.html');
  const cards = startRow(html);
  assert.deepEqual(cards.map((c) => c.id), cfg.PATHS.map((p) => p.id));
  for (const [i, p] of cfg.PATHS.entries()) {
    const sum = p.steps.reduce((n, s) => n + minutesOf(s), 0);
    assert.deepEqual(cards[i], { id: p.id, title: p.title, blurb: p.blurb, label: cfg.pathLabel(p.steps.length, sum) });
  }
  assert.ok(html.indexOf('class="start-here"') < html.indexOf('class="topics"'));
});

test('a guide in a path says which step it is, links Previous and Next, and the last step links back to the path page', () => {
  for (const p of cfg.PATHS) {
    p.steps.forEach((slug, i) => {
      const html = repo.read(`guides/${slug}/index.html`);
      assert.deepEqual(stepLine(html), { href: `/guides/paths/${p.id}/`, text: `Step ${i + 1} of ${p.steps.length} in ${p.title}` }, slug);
      const nav = pathNav(html);
      assert.equal(nav.prev, i === 0 ? null : `/guides/${p.steps[i - 1]}/`, `${slug} previous`);
      assert.equal(nav.next, i === p.steps.length - 1 ? `/guides/paths/${p.id}/` : `/guides/${p.steps[i + 1]}/`, `${slug} next`);
      assert.equal(nav.done, i === p.steps.length - 1, `${slug} only the last step is the end of the path`);
      assert.ok(html.indexOf('class="guide-path-nav"') < html.indexOf('class="guide-related"'), `${slug}: path links come before more in topic`);
      assert.ok(html.indexOf('class="guide-related"') < html.indexOf('class="guide-cta"'));
    });
  }
  const inPath = new Set(cfg.PATHS.flatMap((p) => p.steps));
  for (const g of repoGuides.filter((x) => !inPath.has(x.slug))) {
    const html = repo.read(`guides/${g.slug}/index.html`);
    assert.equal(stepLine(html), null, `${g.slug} is in no path`);
    assert.equal(pathNav(html), null, `${g.slug} is in no path`);
  }
});

test('the sitemap lists every path page', () => {
  const sitemap = repo.read('sitemap.xml');
  for (const p of cfg.PATHS) assert.ok(sitemap.includes(`https://www.gridpulsemedia.com/guides/paths/${p.id}/`), p.id);
});

test('paths made of fixture guides: a whole path, a path with a missing guide, and a guide in two paths', () => {
  assert.equal(px.status, 0, px.log);
  // habit: whole, in order, with the total of 20 + 60 + 15
  const habit = pathPage(px.read('guides/paths/habit/index.html'));
  assert.deepEqual(habit.steps, [{ slug: 'reviews-a', time: 'About 20 minutes' }, { slug: 'reviews-b', time: 'About an hour' }, { slug: 'reviews-d', time: 'About 15 minutes' }]);
  assert.equal(habit.label, '3 steps, about 95 minutes');
  assert.deepEqual(habit.start, ['/guides/reviews-a/', 'Start with step 1']);
  assert.deepEqual(stepLine(px.read('guides/reviews-a/index.html')), { href: '/guides/paths/habit/', text: 'Step 1 of 3 in Build a habit' });
  assert.deepEqual(pathNav(px.read('guides/reviews-a/index.html')), { prev: null, next: '/guides/reviews-b/', done: false });
  assert.deepEqual(pathNav(px.read('guides/reviews-b/index.html')), { prev: '/guides/reviews-a/', next: '/guides/reviews-d/', done: false });
  assert.deepEqual(pathNav(px.read('guides/reviews-d/index.html')), { prev: '/guides/reviews-b/', next: '/guides/paths/habit/', done: true });
  assert.doesNotMatch(px.log, /path habit:/, "habit is whole, so the log has nothing to say about it");
  // ghost: the missing guide is named in the log and left out, the other two stay, and with no minutes there is no total
  assert.match(px.log, /ghost[^\n]*no-such-guide/);
  const ghost = pathPage(px.read('guides/paths/ghost/index.html'));
  assert.deepEqual(ghost.steps, [{ slug: 'reviews-c', time: null }, { slug: 'engine-shaped', time: null }]);
  assert.equal(ghost.label, '2 steps');
  assert.deepEqual(stepLine(px.read('guides/engine-shaped/index.html')), { href: '/guides/paths/ghost/', text: 'Step 2 of 2 in Ghost path' });
  // a guide listed twice in one path is one step, not the first and the last
  assert.match(px.log, /ghost[^\n]*reviews-c[^\n]*twice/);
  assert.deepEqual(stepLine(px.read('guides/reviews-c/index.html')), { href: '/guides/paths/ghost/', text: 'Step 1 of 2 in Ghost path' });
  assert.deepEqual(pathNav(px.read('guides/reviews-c/index.html')), { prev: null, next: '/guides/engine-shaped/', done: false });
  // mixed: one step has no minutes, so no total (not a partial one), and the log names the guide
  const mixed = pathPage(px.read('guides/paths/mixed/index.html'));
  assert.deepEqual(mixed.steps, [{ slug: 'measure-a', time: 'About 25 minutes' }, { slug: 'measure-b', time: null }]);
  assert.equal(mixed.label, '2 steps');
  assert.match(px.log, /path mixed:[^\n]*measure-b[^\n]*minutes/);
  // an id that is not a folder name is not built, and a second path with a taken id does not replace the first
  assert.match(px.log, /Bad Id/);
  assert.ok(!px.has('guides/paths/Bad Id'), 'no folder for a bad id');
  assert.equal(stepLine(px.read('guides/measure-c/index.html')), null);
  assert.equal(stepLine(px.read('guides/typo-topic/index.html')), null);
  // dup: reviews-a already belongs to habit, so it is left out; one step is not a path, so dup is not built
  assert.match(px.log, /dup[^\n]*reviews-a/);
  assert.ok(!px.has('guides/paths/dup/index.html'), 'a path with one step left is not built');
  assert.deepEqual(stepLine(px.read('guides/reviews-a/index.html')).href, '/guides/paths/habit/', 'first path wins');
  assert.equal(stepLine(px.read('guides/typo-topic/index.html')), null);
  assert.equal(pathNav(px.read('guides/typo-topic/index.html')), null);
  // the index row and the sitemap list the paths that were built, and only those
  assert.deepEqual(startRow(px.read('guides/index.html')).map((c) => c.id), ['habit', 'ghost', 'mixed']);
  const sitemap = px.read('sitemap.xml');
  assert.ok(['habit', 'ghost', 'mixed'].every((id) => sitemap.includes(`/guides/paths/${id}/`)));
  assert.ok(!sitemap.includes('Bad'));
  assert.ok(!sitemap.includes('/guides/paths/dup/'));
  // every guide is still listed once under its topic, and still gets more in its topic
  assert.deepEqual([...new Set(sections(px.read('guides/index.html')).flatMap((s) => s.slugs))].sort(), Object.keys(FIXTURE).sort());
  assert.deepEqual(related(px.read('guides/reviews-a/index.html')).slugs, ['reviews-b', 'reviews-c', 'reviews-d']);
});

test('when none of the paths can be built there is no Start here row and no paths folder, and the build still passes', () => {
  // fx uses the real PATHS, whose guides are not in the fixture.
  assert.equal(fx.status, 0, fx.log);
  assert.equal(startRow(fx.read('guides/index.html')), null);
  assert.ok(!fx.has('guides/paths'), 'no paths folder');
  assert.ok(!fx.read('sitemap.xml').includes('/guides/paths/'));
});

test('a guide called "paths" would collide with /guides/paths/, so the build stops and says so', () => {
  assert.notEqual(reserved.status, 0);
  assert.match(reserved.log, /paths/);
  assert.match(reserved.log, /reserved|collide|cannot/i);
});

// ---- Search and filter controls on /guides/ ----

const finderOf = (html) => /<div class="guide-finder"([^>]*)>/.exec(html);
const timeChips = (html) => [...html.matchAll(/<button type="button" class="chip" data-time="(any|\d+)" aria-pressed="(true|false)">([^<]*)<\/button>/g)].map((m) => ({ time: m[1], pressed: m[2] === 'true', text: m[3] }));
const topicChips = (html) => [...html.matchAll(/<button type="button" class="chip" data-topic="([a-z0-9-]+)"(?: data-label="([^"]*)")? aria-pressed="(true|false)">([^<]*)<\/button>/g)].map((m) => ({ topic: m[1], label: m[2] ?? null, pressed: m[3] === 'true', text: m[4] }));
const cardAttrs = (html) => [...html.matchAll(/<li class="guide-card"([^>]*)><a href="\/guides\/([a-z0-9-]+)\/">/g)]
  .map((m) => ({ slug: m[2], topic: /data-topic="([^"]*)"/.exec(m[1])?.[1] ?? null, minutes: /data-minutes="([^"]*)"/.exec(m[1])?.[1] ?? null, keywords: /data-keywords="([^"]*)"/.exec(m[1])?.[1] ?? null }));

test('the time chips are in the config: up to 15 minutes, an hour, an afternoon, each reaching at least one real guide', () => {
  assert.ok(Array.isArray(cfg.TIME_CHIPS));
  assert.deepEqual(cfg.TIME_CHIPS.map((c) => c.minutes), [15, 60, 180]);
  for (const c of cfg.TIME_CHIPS) {
    assert.ok(Number.isInteger(c.minutes) && c.minutes > 0 && c.label, 'a minutes number and a label');
    assert.doesNotMatch(c.label, DASH);
    assert.ok(repoGuides.some((g) => g.minutes && Number(g.minutes) <= c.minutes), `no guide fits "${c.label}"`);
  }
  for (const x of cfg.TOPICS) if (x.short) { assert.ok(x.short.length <= 20, `${x.id}: short name is long for a chip`); assert.doesNotMatch(x.short, DASH); }
});

test('/guides/ ships the search box and chips hidden, so nothing dead shows when the script does not run', () => {
  const html = repo.read('guides/index.html');
  const finder = finderOf(html);
  assert.ok(finder, 'the controls block is there');
  assert.match(finder[1], /\bhidden\b/);
  assert.equal([...html.matchAll(/<input type="search"/g)].length, 1);
  assert.match(html, /<label for="guide-search"[^>]*>[^<]+<\/label>/);
  assert.match(html, /<input type="search" id="guide-search" class="finder-input"/);
  assert.match(html, /<p class="finder-status" role="status"><\/p>/);
  assert.match(html, /<button type="button" class="finder-clear" hidden>[^<]+<\/button>/);
});

test('the time chips are Any time (on) then the chips from the config, and the topic chips are All (on) then each topic that has guides', () => {
  const html = repo.read('guides/index.html');
  assert.deepEqual(timeChips(html), [{ time: 'any', pressed: true, text: 'Any time' }, ...cfg.TIME_CHIPS.map((c) => ({ time: String(c.minutes), pressed: false, text: c.label }))]);
  const used = cfg.TOPICS.filter((x) => repoGuides.some((g) => g.topic === x.id));
  assert.deepEqual(topicChips(html), [{ topic: 'all', label: null, pressed: true, text: 'All' }, ...used.map((x) => ({ topic: x.id, label: x.label, pressed: false, text: x.short || x.label }))]);
});

test('every guide card says its topic, minutes and keywords, so the page script can filter without re-reading the guides', () => {
  const html = repo.read('guides/index.html');
  const cards = cardAttrs(html);
  assert.equal(cards.length, repoGuides.length);
  for (const g of repoGuides) {
    const c = cards.find((x) => x.slug === g.slug);
    assert.equal(c.topic, g.topic || 'more', g.slug);
    assert.equal(c.minutes, g.minutes || null, g.slug);
    assert.equal(c.keywords, g.keywords || null, g.slug);
  }
  const f = cardAttrs(fx.read('guides/index.html'));
  assert.deepEqual(f.find((x) => x.slug === 'reviews-a'), { slug: 'reviews-a', topic: 'reviews', minutes: '20', keywords: 'gmb, google my business' });
  assert.deepEqual(f.find((x) => x.slug === 'engine-shaped'), { slug: 'engine-shaped', topic: 'more', minutes: null, keywords: null });
  assert.deepEqual(f.find((x) => x.slug === 'typo-topic'), { slug: 'typo-topic', topic: 'more', minutes: '10', keywords: 'gmb, google my business' });
});

test('the controls come first, then Start here, then the topics, and the page loads its script', () => {
  const html = repo.read('guides/index.html');
  assert.ok(html.indexOf('class="guide-finder"') < html.indexOf('class="start-here"'));
  assert.ok(html.indexOf('class="start-here"') < html.indexOf('class="topics"'));
  assert.match(html, /<section class="start-here" id="start"/);
  assert.match(html, /<script type="module" src="\/guides\.js"><\/script>/);
});

test('only /guides/ gets the controls and the script, not a guide, a path page or the services list', () => {
  for (const p of ['guides/how-to-answer-a-google-review/index.html', `guides/paths/${cfg.PATHS[0].id}/index.html`, 'services/index.html', 'faq/index.html']) {
    const html = repo.read(p);
    assert.ok(!html.includes('guides.js'), p);
    assert.ok(!html.includes('guide-finder'), p);
  }
});

test('the intro text and its links to /services/ and /start/ are still on /guides/, after the topics', () => {
  const html = repo.read('guides/index.html');
  assert.match(html, /<a href="\/services\/">what we run for you<\/a> or <a href="\/start\/">get started<\/a>/);
  assert.ok(html.indexOf('what we run for you') > html.indexOf('class="topics"'));
  assert.match(html, /<p class="lede">/);
});

test('with no guides there are no controls to show', () => {
  const none = build({});
  assert.equal(none.status, 0, none.log);
  assert.equal(finderOf(none.read('guides/index.html')), null);
});
