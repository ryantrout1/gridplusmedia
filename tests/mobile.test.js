import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Phone layout guards. A browser audit at 320 to 430 px wide found the cost table cut off, the header wrapping,
// the page links hidden, and a section wider than a 320 px screen. These checks keep those fixed.
const css = readFileSync('styles.css', 'utf8');
const home = readFileSync('index.html', 'utf8');

test('every page template has a viewport meta tag', () => {
  for (const f of ['index.html', 'start/index.html', 'start/thanks/index.html', 'scripts/build-guides.mjs']) {
    assert.match(readFileSync(f, 'utf8'), /<meta name="viewport" content="width=device-width, initial-scale=1">/, f);
  }
});

test('the cost table stacks on phones instead of scrolling sideways, and every cell has a label', () => {
  assert.doesNotMatch(css, /\.compare table \{ min-width: 560px; \}/);
  assert.match(css, /@media \(max-width: 640px\) \{[^@]*\.compare td::before \{ content: attr\(data-label\)/);
  const cells = [...home.matchAll(/<tr[^>]*><th scope="row">[^<]*<\/th>(<td[^>]*>)[^<]*<\/td>(<td[^>]*>)/g)];
  assert.equal(cells.length, 6);
  for (const [, a, b] of cells) {
    assert.equal(a, '<td data-label="Typical cost elsewhere">');
    assert.equal(b, '<td data-label="With us">');
  }
});

test('the header keeps the page links on phones instead of hiding them', () => {
  assert.doesNotMatch(css, /\.nav a:not\(\.btn\) \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 820px\) \{[^@]*\.nav \{ display: contents; \}/);
});

test('the banner demo grid cannot be wider than a 320 px screen', () => {
  assert.match(css, /minmax\(min\(280px, 100%\), 1fr\)/);
  assert.doesNotMatch(css, /repeat\(auto-fit, minmax\(280px, 1fr\)\)/);
});

test('tap targets on phones are at least 44 px and the dialog fits a phone screen', () => {
  assert.match(css, /\.inc-more \{ min-height: 44px;/);
  assert.match(css, /\.site-footer a \{[^}]*min-height: 44px/);
  assert.match(css, /max-height: calc\(100dvh - 32px\)/);
});

test('the search box, the chips and the clear button are at least 44 px tall, and the search text is at least 16 px so phones do not zoom', () => {
  assert.match(css, /\.chip \{[^}]*min-height: 44px/);
  assert.match(css, /\.finder-input \{[^}]*min-height: 44px/);
  assert.match(css, /\.finder-input \{[^}]*font-size: (1[6-9]|[2-9]\d)px/);
  assert.match(css, /\.finder-clear \{[^}]*min-height: 44px/);
});

test('the step line and the Previous and Next links on a guide in a path are at least 44 px tall', () => {
  assert.match(css, /\.guide-path a \{[^}]*min-height: 44px/);
  assert.match(css, /\.guide-path-nav a \{[^}]*min-height: 44px/);
});

test('cards, sections and controls the page script hides stay hidden (their display rules must not beat the hidden attribute)', () => {
  for (const sel of ['.guide-finder', '.guide-card', '.topic', '.topics', '.start-here', '.finder-clear']) {
    const re = new RegExp(sel.replace('.', '\\.') + '\\[hidden\\][^{]*\\{[^}]*display: none');
    assert.match(css, re, sel);
  }
});

test('the chips wrap on a phone instead of running off the side, and nothing in the controls has a fixed width', () => {
  assert.match(css, /\.finder-chips \{[^}]*flex-wrap: wrap/);
  assert.doesNotMatch(css, /\.(chip|finder-input|guide-finder|finder-chips)\s*\{[^}]*[^-]width: \d+px/);
});
