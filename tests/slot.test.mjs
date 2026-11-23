import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ORIGINAL_SCORE_SUM, originalStatistics } from '../src/game/original-outcome-table.mjs';

test('both Slot Engine tables preserve the exact payout fractions and seed weights', () => {
  const title = JSON.parse(readFileSync(new URL('../slot/title.json', import.meta.url)));
  assert.equal(title.betConfigurations.length, 2);
  for (const [formation, configuration] of title.betConfigurations.entries()) {
    assert.equal(configuration.prizeDenominator, ORIGINAL_SCORE_SUM[formation] * 100);
    const csv = readFileSync(new URL('../slot/' + configuration.tierList, import.meta.url), 'utf8');
    const tiers = csv.trim().split(/\r?\n/).slice(1);
    assert.deepEqual(tiers, originalStatistics(formation).distribution.map(({ score, count }) =>
      `${score * 2565}/${configuration.prizeDenominator},${count / 27}`));
  }
});
