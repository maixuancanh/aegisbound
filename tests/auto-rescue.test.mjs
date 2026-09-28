import test from 'node:test';
import assert from 'node:assert/strict';
import * as rescue from '../src/game/auto-rescue.mjs';
const { simulateRescue } = rescue;

test('arrival-order change uses replay rules version two', () => {
  assert.equal(rescue.RESCUE_RULES_VERSION, 2);
});

test('a rescue has five civilians, three bounded waves and ordered events', () => {
  const result = simulateRescue(0, 0);
  assert.equal(result.civilians.length, 5);
  assert.equal(result.waves.length, 3);
  assert.ok(result.waves.every(wave => wave.enemies.length >= 2 && wave.enemies.length <= 4));
  assert.ok(result.events.every((event, i) => event.ordinal === i));
  assert.ok(result.civilians.every(civilian => ['boarded', 'lost'].includes(civilian.status)));
});

test('each wave shows the full group entering and approaching before anyone attacks', () => {
  for (const formation of [0, 1]) for (let outcome = 0; outcome < 729; outcome++) {
    const round = simulateRescue(formation, outcome);
    for (const wave of round.waves) {
      const events = round.events.filter(event => event.wave === wave.index);
      const firstCombat = events.findIndex(event => ['place', 'throw', 'shot'].includes(event.type));
      const arrivals = events.slice(0, firstCombat);
      const spawns = arrivals.filter(event => event.type === 'spawn');
      const approaches = arrivals.filter(event => event.type === 'approach');
      assert.equal(spawns.length, wave.enemies.length, `${formation}/${outcome}/${wave.index} spawn`);
      assert.equal(approaches.length, wave.enemies.length, `${formation}/${outcome}/${wave.index} approach`);
      assert.ok(Math.max(...spawns.map(event => event.ordinal)) < Math.min(...approaches.map(event => event.ordinal)));
      assert.deepEqual(new Set(spawns.map(event => event.sourceId)), new Set(approaches.map(event => event.sourceId)));
    }
  }
});

test('auto-rescue has reachable losses without making most wagers hopeless', () => {
  for (const formation of [0, 1]) {
    const rounds = Array.from({ length: 729 }, (_, outcome) => simulateRescue(formation, outcome));
    assert.ok(rounds.some(round => round.boarded === 0));
    assert.ok(rounds.filter(round => round.boarded > 0).length >= 500);
    assert.ok(rounds.reduce((sum, round) => sum + round.boarded, 0) >= 729 * 1.5);
  }
});

test('armor, capture and shield identity remain causal for every outcome', () => {
  for (const formation of [0, 1]) for (let outcome = 0; outcome < 729; outcome++) {
    const round = simulateRescue(formation, outcome);
    const enemies = round.waves.flatMap(wave => wave.enemies);
    const captured = round.events.filter(event => event.type === 'capture');
    assert.equal(new Set(captured.map(event => event.sourceId)).size, captured.length);
    for (const enemy of enemies) {
      const events = round.events.filter(event => event.sourceId === enemy.id);
      assert.ok(events.some(event => event.type === 'approach' && event.state === 'throwable-standoff'));
      if (enemy.status === 'captured') {
        assert.equal(events.filter(event => event.type === 'armor-hit').length, enemy.armorHitsToBreak);
        assert.equal(events.filter(event => event.type === 'armor-break').length, 1);
        assert.equal(events.filter(event => event.type === 'capture').length, 1);
        assert.ok(events.some(event => event.type === 'return' && event.state === 'captured-shield'));
        assert.ok(round.shields.some(shield => shield.capturedId === enemy.id));
      } else {
        assert.equal(enemy.status, 'retreated');
        assert.ok(!events.some(event => event.type === 'capture'));
      }
    }
    assert.equal(round.score, round.boarded ? 2 * round.boarded + round.captures + round.blocks : 0);
  }
});
