import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL_BOARDED, ORIGINAL_BOARDING_SCORE, ORIGINAL_SCORE_SUM,
  originalBoardedFor, originalPayoutFor, originalScoreFor, originalStatistics } from '../src/game/original-outcome-table.mjs';

test('Solidity boarding table, score and payout constants match the original engine table', () => {
  const source = readFileSync(new URL('../contracts/BorrowedAegisAuto.sol', import.meta.url), 'utf8');
  const hex = [...source.matchAll(/bytes27 private constant (BASTION|SWEEP) = hex"([0-9a-f]+)"/g)];
  assert.equal(hex.length, 2);
  for (const [formation, row] of ORIGINAL_BOARDED.entries()) {
    assert.equal(hex[formation][2], row.map(number => number.toString(16).padStart(2, '0')).join(''));
    assert.match(source, new RegExp(formation === 0 ? '506' : '426'));
    for (let outcome = 0; outcome < 729; outcome++) {
      const boarded = Number.parseInt(hex[formation][2].slice(outcome % 27 * 2, outcome % 27 * 2 + 2), 16);
      assert.equal(boarded, originalBoardedFor(formation, outcome));
      const score = ORIGINAL_BOARDING_SCORE[boarded];
      assert.equal(score, originalScoreFor(formation, outcome));
      const contractFormula = 10000n * BigInt(score) * 2565n / (100n * BigInt(ORIGINAL_SCORE_SUM[formation]));
      assert.equal(contractFormula, originalPayoutFor(10000n, formation, outcome));
    }
    assert.ok(originalStatistics(formation).rtp > .93);
    assert.ok(originalStatistics(formation).rtp < .98);
  }
});
