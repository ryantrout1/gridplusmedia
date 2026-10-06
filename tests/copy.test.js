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
  assert.match(faqs[0].answer, /not a list of posts/);
  assert.match(faqs[0].answer, /on brand, on theme and on message/);
  assert.match(faqs[1].answer, /same topic/);
  assert.match(faqs[1].answer, /do not look the same/);
  assert.match(faqs[1].answer, /back to your (?:website|site)/);
  assert.doesNotMatch(raw, /[–—]/);
});
