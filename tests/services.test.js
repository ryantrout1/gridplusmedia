// The /services/ page lists each distinct service once. A page for one kind of business (electrician, plumber...)
// or one that covers the same ground as another service is linked in a short row under the list, not repeated.
// The build writes services/index.html, so the test builds first.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

let html;
before(() => {
  execFileSync('node', ['scripts/build-guides.mjs'], { stdio: 'ignore' });
  html = readFileSync('services/index.html', 'utf8');
});

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const STOP = new Set('a an and the of for to in on your you we our is are with from that this it as at by or so be into'.split(' '));
const words = (s) => new Set((s.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !STOP.has(w)));
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n); };

// The entries in the main list: link, heading and description.
function entries() {
  const list = /<ul class="guide-list">([\s\S]*?)<\/ul>/.exec(html);
  assert.ok(list, 'the main list is there');
  return [...list[1].matchAll(/<li><a href="([^"]+)"><h2>([\s\S]*?)<\/h2><\/a><p>([\s\S]*?)<\/p><\/li>/g)].map((m) => ({ href: m[1], title: text(m[2]), desc: text(m[3]) }));
}
const rows = () => [...html.matchAll(/<ul class="link-row">([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)].map((a) => a[1]));

test('no two entries in the main list say the same thing', () => {
  const list = entries();
  assert.ok(list.length >= 6);
  assert.equal(new Set(list.map((e) => e.href)).size, list.length);
  assert.equal(new Set(list.map((e) => e.title.toLowerCase())).size, list.length);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    assert.ok(overlap(list[i].desc, list[j].desc) < 0.5, `${list[i].title} and ${list[j].title} read as the same service`);
  }
});

test('pages for one kind of business are not entries, they are links in a row', () => {
  const main = entries().map((e) => e.href);
  const row = rows().flat();
  for (const slug of ['electrician', 'esthetician', 'plumber', 'restaurant']) {
    const href = `/${slug}-marketing-service/`;
    assert.ok(!main.includes(href), `${href} should not be a list entry`);
    assert.ok(row.includes(href), `${href} should be linked in the row`);
  }
  assert.match(html, /For your type of business/);
});

test('pages that cover the same ground as another service are linked in a row too', () => {
  const main = entries().map((e) => e.href);
  const row = rows().flat();
  for (const href of ['/listing-consistency-service/', '/website-social-posting-service/']) {
    assert.ok(!main.includes(href), `${href} should not be a list entry`);
    assert.ok(row.includes(href), `${href} should be linked in the row`);
  }
});

test('every service page is still linked from /services/, so none is orphaned', () => {
  const linked = new Set([...entries().map((e) => e.href), ...rows().flat()]);
  const services = readdirSync('content/pages').filter((f) => f.endsWith('.md'))
    .filter((f) => /^kind: "?service/m.test(readFileSync(`content/pages/${f}`, 'utf8'))).map((f) => `/${f.replace(/\.md$/, '')}/`);
  assert.ok(services.length >= 13);
  for (const s of services) assert.ok(linked.has(s), `${s} is not linked from /services/`);
});

test('no link appears twice on the page', () => {
  const hrefs = [...html.matchAll(/<a href="(\/[a-z0-9-]+\/)"/g)].map((m) => m[1]).filter((h) => !['/', '/guides/', '/services/', '/faq/', '/start/', '/privacy/', '/terms/'].includes(h));
  assert.deepEqual(hrefs.filter((h, i) => hrefs.indexOf(h) !== i), []);
});
