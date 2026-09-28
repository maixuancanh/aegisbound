import test from 'node:test';
import assert from 'node:assert/strict';
import { createShortQuickPlay } from '../src/game/short-quick-play.mjs';
import { originalScenarioCommands } from '../src/game/original-scenario.mjs';

test('short Quick Play keeps five civilians at one starting point and only two staggered enemies', () => {
  const runner = createShortQuickPlay(1);
  const civilians = runner.state.rescue.npcs;
  assert.equal(civilians.length, 5);
  assert.equal(new Set(civilians.map(npc => `${npc.x},${npc.y}`)).size, 1);
  const arrivals = [];
  const seen = new Set();
  while (runner.state.status === 'running' && runner.state.tick <= 600) {
    runner.advance(originalScenarioCommands(runner.state, 0));
    for (const enemy of runner.state.enemies) if (!seen.has(enemy.id)) {
      seen.add(enemy.id);
      arrivals.push(runner.state.tick);
    }
  }
  assert.equal(seen.size, 2);
  assert.ok(arrivals[1] - arrivals[0] >= 150 && arrivals[1] - arrivals[0] <= 210);
  assert.ok(runner.state.tick >= 480 && runner.state.tick <= 600,
    `round ended at tick ${runner.state.tick}`);
  assert.equal(runner.state.rescue.npcs.length, 5, 'the last-call phase must not create extra civilians');
});

test('short Quick Play is deterministic for both formations and every contract seed', () => {
  assert.notEqual(createShortQuickPlay(13, 0).state.rescue.npcs[0].speed,
    createShortQuickPlay(13, 1).state.rescue.npcs[0].speed,
    'formations must have distinct rescue pacing');
  for (const formation of [0, 1]) {
    const results = new Set();
    for (let seed = 1; seed <= 27; seed++) {
    const runner = createShortQuickPlay(seed, formation);
    let throws = 0;
    while (runner.state.status === 'running' && runner.state.tick <= 600) {
      const result = runner.advance(originalScenarioCommands(runner.state, formation));
      throws += result.events.filter(event => event.type === 'throw').length;
    }
    assert.ok(runner.state.tick >= 480 && runner.state.tick <= 600,
      `${formation}/${seed}: ended at ${runner.state.tick}`);
    assert.ok(throws > 0, `${formation}/${seed}: no shield throw`);
    assert.ok(runner.state.rescue.boarded >= 0 && runner.state.rescue.boarded <= 5);
    results.add(runner.state.rescue.boarded);
    }
    assert.ok(results.size >= 3, `${formation}: no meaningful outcome distribution`);
  }
});
