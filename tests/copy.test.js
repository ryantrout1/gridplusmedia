import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// The 90-day plan is built after the owner starts (pays), not on the setup call. The engine drafts new pages,
// so this catches a draft that puts the plan back on the call.
const dirs = ['content/pages', 'content/guides'];
const ON_THE_CALL = [
  /(?:setup call|first call|on the call)[^.]{0,120}\b(?:map(?:s|ped)? out|build|builds|built)\b[^.]{0,60}90-day/i,
  /\b(?:map(?:s|ped)? out|build|builds|built)\b[^.]{0,80}90-day[^.]{0,60}(?:on|at|during) (?:the|your) (?:first )?(?:setup )?call/i,
  /\b(?:map(?:s|ped)? out|build)\b[^.]{0,60}(?:next )?90 days[^.]{0,40}(?:on|at|during) (?:the|your) (?:first )?(?:setup )?call/i,
  /setup call,? where we (?:build|map out)[^.]{0,60}90-day/i,
  /(?:at|after) (?:the|your) setup call,? we (?:build|map out)/i,
];

test('no page or guide says the 90-day plan is built on the setup call', () => {
  const hits = [];
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const text = readFileSync(`${dir}/${name}`, 'utf8').replace(/\\"/g, '"');
      for (const re of ON_THE_CALL) {
        const m = re.exec(text);
        if (m) hits.push(`${dir}/${name}: ${m[0].slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});

// The 90-day plan is one plan across every channel, with each piece working with the others. The FAQ leads with that.
test('the 90-day plan FAQ leads with what the plan is and how the channels work together', () => {
  const raw = readFileSync('content/pages/90-day-plan-faq.md', 'utf8');
  const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const faqs = JSON.parse(JSON.parse(/^faqs: (.*)$/m.exec(front)[1]));
  assert.equal(faqs[0].question, 'What is the 90-day marketing plan?');
  assert.equal(faqs[1].question, 'How do my website, Instagram and Facebook work together?');
  for (const q of faqs.slice(0, 2)) assert.ok(body.includes(`### ${q.question}`) && body.includes(q.answer), `${q.question} is in the body`);
  assert.match(faqs[0].answer, /one plan for your whole online presence, not a list of posts/);
  assert.match(body, /one plan for your whole online presence, with your website, Google profile, Instagram and Facebook each supporting the others/);
  assert.doesNotMatch(body.split('## Frequently')[0], /everywhere/);
  assert.match(faqs[0].answer, /on brand, on theme and on message/);
  assert.match(faqs[1].answer, /same topic/);
  assert.match(faqs[1].answer, /do not look the same/);
  assert.match(faqs[1].answer, /back to your (?:website|site)/);
  assert.doesNotMatch(raw, /[–—]/);
});

test('the home page does not say the 90-day plan is built on the setup call, and says what the plan is', () => {
  const home = readFileSync('index.html', 'utf8');
  const step = /<h3>(A call, then your[\s\S]*?)<\/h3>\s*<p>([^<]*)<\/p>/.exec(home);
  assert.ok(step, 'step 1 is there');
  assert.equal(step[1].replace(/<[^>]*>/g, ''), 'A call, then your 90-day plan');
  assert.doesNotMatch(step[2], /then map out the next 90 days/);
  assert.match(step[2], /Once you start, we write a plan for your whole online presence/);
  assert.match(step[2], /You read it and ask for changes/);
  assert.doesNotMatch(step[2], /everywhere/i);
  for (const re of ON_THE_CALL) assert.doesNotMatch(home, re);
});

test('the plan leads the included list and the pricing section says it is built around goals', () => {
  const home = readFileSync('index.html', 'utf8');
  const cards = [...home.matchAll(/<article class="inc-card">\s*<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  assert.equal(cards[0], 'A marketing plan built around your goals');
  assert.match(home, /A marketing plan built around your goals for your online presence, checked every week and refreshed every quarter\./);
  assert.match(home, /<th scope="row">Social posts, written to your plan<\/th>/);
  assert.match(home, /<th scope="row">Blog articles, tied to your plan<\/th>/);
  assert.match(home, /<th scope="row">All of it, planned around your goals, from one marketing company<\/th>/);
  assert.match(home, /<td data-label=\"Typical cost elsewhere\">\$2,500 to \$7,500 a month<\/td><td data-label=\"With us\">\$349 a month<\/td>/);
  assert.doesNotMatch(home, /[–—]/);
});

test('the plan band says it is one plan across the website, Google profile and social accounts', () => {
  const home = readFileSync('index.html', 'utf8');
  const band = /<article class="inc-card">\s*<h3>(A marketing plan built around your goals)<\/h3>([\s\S]*?)<\/article>/.exec(home);
  assert.ok(band, 'the plan band is there');
  const text = band[2].replace(/<[^>]*>/g, ' ');
  assert.match(text, /one plan for your whole online presence/i);
  assert.match(text, /built around what you want to accomplish/);
  assert.match(text, /Checked every week, refreshed every quarter/);
  assert.match(text, /Each week we look at your numbers against your goals/);
  assert.match(text, /a plan without a goal is just a posting calendar/i);
  assert.doesNotMatch(band[1] + text, /everywhere/i);
});

// The home page carries one short why line under the hero. No dashes in it.
test('home page has the why line and no dashes in it', () => {
  const html = readFileSync('index.html', 'utf8');
  const m = /<p class="why-line">([^<]+)<\/p>/.exec(html);
  assert.ok(m, 'why line missing');
  assert.match(m[1], /Good businesses shouldn't disappear because marketing is hard\./);
  assert.ok(!/[‒–—―]/.test(m[1]));
  assert.ok(html.indexOf('class="why"') > html.indexOf('class="hero"'));
  assert.ok(html.indexOf('class="why"') < html.indexOf('class="channels"'));
});
