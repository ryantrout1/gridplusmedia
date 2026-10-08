// The filter behind the search box and chips on /guides/. It is plain functions (no page, no DOM), so it is tested here
// directly. guides.js only reads the cards off the page, calls these, and shows or hides what comes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, matches, filterCards, countLabel, isFiltered } from '../guides-filter.js';

const DASH = new RegExp('[\\u2010-\\u2015\\u2212]');
const card = (o) => ({ title: '', description: '', topic: 'reviews', topicLabel: 'Reviews', keywords: '', minutes: 20, ...o });
const CARDS = [
  card({ id: 'claim', title: 'How to Claim and Verify Your Google Business Profile', description: 'Step by step: find out if your business already has a Google profile.', topic: 'google-profile', topicLabel: 'Your Google profile', keywords: 'gmb, google my business, verify, postcard', minutes: 20 }),
  card({ id: 'answer', title: 'How to Answer a Google Review, Good or Bad', description: 'A simple way to answer Google reviews in three lines.', topic: 'reviews', topicLabel: 'Reviews', keywords: 'reply, respond, negative review', minutes: 10 }),
  card({ id: 'plan', title: 'A 90 Day Posting Plan You Can Copy', description: 'Pick three themes and rotate them week by week.', topic: 'posting', topicLabel: 'Posting and content', keywords: 'schedule, calendar', minutes: 90 }),
  card({ id: 'setup', title: 'How to Set Up a Google Business Profile', description: 'A checklist for setting up your listing.', topic: 'google-profile', topicLabel: 'Your Google profile', keywords: 'gmb', minutes: 120 }),
  card({ id: 'restaurant', title: 'Marketing a Restaurant in the West Valley', description: 'A step by step plan for restaurants.', topic: 'industry', topicLabel: 'For your type of business', keywords: '', minutes: 180 }),
  card({ id: 'engine', title: 'Engine Written Guide', description: 'Written by the engine, so no topic and no minutes.', topic: 'more', topicLabel: '', keywords: '', minutes: null }),
];
const ALL = { q: '', topic: 'all', time: 'any' };
const ids = (state) => filterCards(CARDS, { ...ALL, ...state }).map((c) => c.id);

test('normalize lowercases, drops apostrophes and punctuation, and collapses spaces', () => {
  assert.equal(normalize("Google's  Local-Search!"), 'googles local search');
  assert.equal(normalize('90-day PLAN'), '90 day plan');
  assert.equal(normalize('Café'), 'cafe');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('with nothing chosen every guide shows, in the same order', () => {
  assert.deepEqual(ids({}), ['claim', 'answer', 'plan', 'setup', 'restaurant', 'engine']);
  assert.deepEqual(ids({ q: '   ' }), ['claim', 'answer', 'plan', 'setup', 'restaurant', 'engine']);
});

test('search: every typed word has to match, in the title, description, topic name or keywords', () => {
  assert.deepEqual(ids({ q: 'google profile' }), ['claim', 'setup']);
  assert.deepEqual(ids({ q: 'google review' }), ['answer']);
  assert.deepEqual(ids({ q: 'gmb' }), ['claim', 'setup'], 'keywords');
  assert.deepEqual(ids({ q: 'content' }), ['plan'], 'topic name only');
  assert.deepEqual(ids({ q: 'three lines' }), ['answer'], 'description');
  assert.deepEqual(ids({ q: 'claim zebra' }), [], 'one word that matches nothing');
});

test('search matches the start of a word, so partial typing works and mid-word noise does not', () => {
  assert.deepEqual(ids({ q: 'revi' }), ['answer']);
  assert.deepEqual(ids({ q: 'view' }), []);
  assert.deepEqual(ids({ q: 'ad' }), [], 'ad is not the start of any word here');
});

test('search treats a plural as the word it comes from', () => {
  assert.deepEqual(ids({ q: 'postcards' }), ['claim']);
  assert.deepEqual(ids({ q: 'profiles' }), ['claim', 'setup']);
  assert.deepEqual(ids({ q: 'reviews' }), ['answer']);
});

test('a typed plural also finds the whole singular word (es, ies and s), but a short word is not cut down into a prefix of other words', () => {
  const two = [
    card({ id: 'biz', title: 'Marketing for a salon business', description: 'Pick the right category.', topicLabel: '' }),
    card({ id: 'prof', title: 'Your profile and the process', description: 'Photos and hours.', topicLabel: '' }),
  ];
  const got = (q) => filterCards(two, { ...ALL, q }).map((c) => c.id);
  assert.deepEqual(got('businesses'), ['biz']);
  assert.deepEqual(got('categories'), ['biz']);
  assert.deepEqual(got('photos'), ['prof']);
  assert.deepEqual(got('pros'), [], 'pros is not a way to type profile or process');
  assert.deepEqual(got('this'), [], 'this is not cut down to thi');
});

test('letters from other languages count as letters, so a search in them finds nothing instead of being ignored', () => {
  assert.equal(normalize('Отзывы'), 'отзывы');
  assert.deepEqual(ids({ q: 'отзывы' }), []);
  assert.equal(isFiltered({ q: 'отзывы' }), true);
});

test('search ignores case and punctuation', () => {
  assert.deepEqual(ids({ q: 'GMB!' }), ids({ q: 'gmb' }));
  assert.deepEqual(ids({ q: '90-day' }), ['plan']);
  assert.deepEqual(ids({ q: '  Google,   PROFILE ' }), ['claim', 'setup']);
});

test('a topic chip shows that topic only, and More guides are the ones with no topic', () => {
  assert.deepEqual(ids({ topic: 'google-profile' }), ['claim', 'setup']);
  assert.deepEqual(ids({ topic: 'more' }), ['engine']);
  assert.deepEqual(ids({ topic: 'no-such-topic' }), []);
});

test('a time chip means "up to": that many minutes or fewer', () => {
  assert.deepEqual(ids({ time: 15 }), ['answer']);
  assert.deepEqual(ids({ time: 60 }), ['claim', 'answer']);
  assert.deepEqual(ids({ time: 180 }), ['claim', 'answer', 'plan', 'setup', 'restaurant']);
});

test('a guide with no minutes is hidden while a time chip is on, and shows again on Any time', () => {
  assert.ok(!ids({ time: 180 }).includes('engine'));
  assert.ok(ids({ time: 'any' }).includes('engine'));
  assert.equal(matches(card({ minutes: undefined }), { ...ALL, time: 180 }), false);
  assert.equal(matches(card({ minutes: 0 }), { ...ALL, time: 180 }), false);
});

test('search, topic and time work together', () => {
  assert.deepEqual(ids({ q: 'gmb', time: 60 }), ['claim']);
  assert.deepEqual(ids({ q: 'gmb', topic: 'google-profile', time: 180 }), ['claim', 'setup']);
  assert.deepEqual(ids({ q: 'gmb', topic: 'reviews' }), []);
  assert.deepEqual(ids({ q: 'gmb', topic: 'google-profile', time: 15 }), []);
});

test('filterCards keeps the order and does not change what it was given', () => {
  const copy = JSON.stringify(CARDS);
  assert.deepEqual(ids({ time: 180 }), ['claim', 'answer', 'plan', 'setup', 'restaurant']);
  assert.equal(JSON.stringify(CARDS), copy);
});

test('a card with missing fields does not break the filter', () => {
  const bare = { title: 'Bare', topic: 'more', minutes: 10 };
  assert.equal(matches(bare, { ...ALL, q: 'bare' }), true);
  assert.equal(matches(bare, { ...ALL, q: 'gmb' }), false);
  assert.equal(matches(bare, ALL), true);
  assert.equal(matches(bare), true, 'no state at all means no filter');
});

test('countLabel says how many guides, or that none match', () => {
  assert.equal(countLabel(31), '31 guides');
  assert.equal(countLabel(2), '2 guides');
  assert.equal(countLabel(1), '1 guide');
  assert.equal(countLabel(0), 'No guides match');
});

test('isFiltered is true only when something is chosen or typed', () => {
  assert.equal(isFiltered(ALL), false);
  assert.equal(isFiltered({ ...ALL, q: '   ' }), false);
  assert.equal(isFiltered({ ...ALL, q: 'gmb' }), true);
  assert.equal(isFiltered({ ...ALL, topic: 'reviews' }), true);
  assert.equal(isFiltered({ ...ALL, time: 15 }), true);
});

test('the filter module has no page code in it, the page script uses it, and neither has a dash in its wording', () => {
  const filter = readFileSync('guides-filter.js', 'utf8');
  const page = readFileSync('guides.js', 'utf8');
  assert.doesNotMatch(filter, /\b(document|window|navigator|localStorage)\b/);
  assert.match(page, /from ['"]\.\/guides-filter\.js['"]/);
  assert.doesNotMatch(filter, DASH);
  assert.doesNotMatch(page, DASH);
});
