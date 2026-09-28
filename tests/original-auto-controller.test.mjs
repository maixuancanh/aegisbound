import test from 'node:test';
import assert from 'node:assert/strict';
import { createOriginalRunner } from '../src/game/original-runner.mjs';
import { originalAutoCommands } from '../src/game/original-auto-controller.mjs';

test('autopilot never mutates state and uses original command names', () => {
  const state = createOriginalRunner(17).state;
  const snapshot = structuredClone(state);
  const commands = originalAutoCommands(state);
  assert.deepEqual(state, snapshot);
  assert.ok(commands.every(command => ['hold', 'aim', 'release', 'place', 'repair', 'depart', 'stay'].includes(command.type)));
});

test('autopilot resolves original departure choice without user input', () => {
  const state = createOriginalRunner(17).state;
  state.rescue.phase = 'choice';
  state.rescue.boarded = state.rescue.goal;
  assert.deepEqual(originalAutoCommands(state), [{ type: 'depart' }]);
  state.rescue.boarded = 0;
  assert.deepEqual(originalAutoCommands(state), [{ type: 'stay' }]);
});

test('autopilot reaches a real terminal state through original simulation', () => {
  const play = seed => {
    const runner = createOriginalRunner(seed);
    const types = [];
    while (runner.state.status === 'running' && runner.state.tick < 22000) {
      const result = runner.advance(originalAutoCommands(runner.state));
      for (const event of result.events) types.push(event.type);
    }
    return { state: runner.state, types };
  };
  for (const seed of [1, 17, 73]) {
    const first = play(seed), second = play(seed);
    assert.notEqual(first.state.status, 'running', `seed ${seed} finished`);
    assert.ok(first.types.includes('throw'), `seed ${seed} actually threw a cover`);
    assert.ok(first.state.rescue.van.departed, `seed ${seed} taxi departed`);
    assert.deepEqual(first, second, `seed ${seed} is deterministic`);
  }
});
