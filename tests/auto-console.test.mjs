import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayProgress } from '../src/game/replay-progress.mjs';

test('replay progress is bounded and reaches completion', () => {
  assert.equal(replayProgress(0, 20), 0);
  assert.equal(replayProgress(5, 20), .25);
  assert.equal(replayProgress(20, 20), 1);
  assert.equal(replayProgress(25, 20), 1);
  assert.equal(replayProgress(0, 0), 0);
});

test('console keeps last return above and cast button beside progress below', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="controls">([\s\S]*?)<\/form>/)?.[1];
  const below = html.match(/<section class="below">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(form?.includes('id="result"'));
  assert.ok(!form?.includes('id="cast"'));
  assert.ok(below?.includes('id="replay-progress"'));
  assert.ok(below?.includes('id="cast"'));
  assert.match(below, /id="cast"[^>]*form="controls"/);
});
