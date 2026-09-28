import test from 'node:test';
import assert from 'node:assert/strict';
import { createOriginalRunner } from '../src/game/original-runner.mjs';

test('original Quick Play advances repeatably without mutating its prior state', () => {
  const left = createOriginalRunner(17);
  const right = createOriginalRunner(17);
  const firstState = left.state;
  for (let tick = 0; tick < 600; tick++) {
    assert.deepEqual(left.advance([]).events, right.advance([]).events);
  }
  assert.equal(firstState.tick, 0, 'stepRun does not mutate its input state');
  assert.equal(left.state.tick, 600);
  assert.deepEqual(left.state, right.state);
  assert.equal(left.state.mode, 'rescue');
});
