import test from 'node:test';
import assert from 'node:assert/strict';
import { createOriginalScenario, originalScenarioCommands, summarizeOriginalScenario, ORIGINAL_RULES_VERSION } from '../src/game/original-scenario.mjs';
import { ORIGINAL_BOARDED, originalBoardedFor, originalPayoutFor, originalStatistics } from '../src/game/original-outcome-table.mjs';

test('outcome selects one original deterministic seed', () => {
  assert.equal(ORIGINAL_RULES_VERSION, 4);
  assert.equal(createOriginalScenario(0, 0).state.tick, 0);
  assert.equal(createOriginalScenario(0, 0).state.rescue.shortRound, true);
  assert.throws(() => createOriginalScenario(0, 729), RangeError);
  assert.throws(() => createOriginalScenario(2, 0), RangeError);
});

test('formation command cadence is deterministic and preserves original commands', () => {
  const state = createOriginalScenario(0, 0).state;
  const before = structuredClone(state);
  assert.deepEqual(originalScenarioCommands(state, 0), originalScenarioCommands(state, 0));
  assert.deepEqual(state, before);
});

test('original scenarios finish with observable rescue, armor, and captures', () => {
  const cases = [0, 16, 72];
  for (const formation of [0, 1]) for (const outcome of cases) {
    const first = summarizeOriginalScenario(formation, outcome);
    assert.deepEqual(first, summarizeOriginalScenario(formation, outcome));
    assert.ok(first.boarded >= 0 && first.boarded <= 5);
    assert.ok(first.throws > 0);
  }
});

test('all 729 contract outcomes repeat one of 27 measured original rescue runs', () => {
  for (const formation of [0, 1]) {
    for (let seed = 0; seed < 27; seed++) {
      const result = summarizeOriginalScenario(formation, seed);
      assert.equal(result.boarded, ORIGINAL_BOARDED[formation][seed], `formation ${formation}, seed ${seed + 1}`);
      assert.ok(result.captures > 0);
    }
    for (let outcome = 0; outcome < 729; outcome++) {
      assert.equal(originalBoardedFor(formation, outcome), ORIGINAL_BOARDED[formation][outcome % 27]);
      assert.equal(originalPayoutFor(10000n, formation, outcome),
        originalPayoutFor(10000n, formation, outcome % 27));
    }
    const rtp = originalStatistics(formation).rtp;
    assert.ok(rtp > .93 && rtp < .98, `formation ${formation}: ${rtp}`);
  }
});
