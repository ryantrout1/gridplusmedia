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
