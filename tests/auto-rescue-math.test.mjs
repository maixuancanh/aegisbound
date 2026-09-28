import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRescue } from '../src/game/auto-rescue.mjs';
import { rescuePayoutFor, rescueStatistics } from '../src/game/auto-rescue-math.mjs';

test('rescue payout follows the visible rescue score with 93–98% RTP', () => {
  for (const formation of [0, 1]) for (const wager of [100n, 101n, 10000n, 10n ** 24n]) {
    const payouts = Array.from({ length: 729 }, (_, outcome) => rescuePayoutFor(wager, formation, outcome));
    const stats = rescueStatistics(formation, wager);
    assert.equal(stats.totalPayout, payouts.reduce((a, b) => a + b, 0n));
    assert.equal(stats.maxPayout, payouts.reduce((a, b) => a > b ? a : b));
    assert.equal(stats.distribution.reduce((sum, row) => sum + row.count, 0), 729);
    assert.ok(stats.totalPayout * 100n >= wager * 729n * 93n);
    assert.ok(stats.totalPayout * 100n <= wager * 729n * 98n);
    for (let outcome = 0; outcome < 729; outcome++) {
      if (simulateRescue(formation, outcome).boarded === 0) assert.equal(payouts[outcome], 0n);
    }
  }
});
