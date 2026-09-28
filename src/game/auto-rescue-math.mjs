import { RESCUE_FORMATIONS, RESCUE_OUTCOMES, simulateRescue } from './auto-rescue.mjs';

export const RESCUE_MIN_WAGER = 100n;
export const RESCUE_MAX_WAGER = 10n ** 24n;

function formationOf(value) {
  const formation = RESCUE_FORMATIONS.find(item => value === item.id || value === item.key || value === item);
  if (!formation) throw new RangeError('Unknown rescue formation');
  return formation;
}
function checkWager(wager) {
  if (typeof wager !== 'bigint' || wager < RESCUE_MIN_WAGER || wager > RESCUE_MAX_WAGER) {
    throw new RangeError('Wager outside rescue contract bounds');
  }
}

const tables = RESCUE_FORMATIONS.map(formation => {
  const scores = Array.from({ length: RESCUE_OUTCOMES }, (_, outcome) => simulateRescue(formation, outcome).score);
  const counts = Array(Math.max(...scores) + 1).fill(0);
  for (const score of scores) counts[score]++;
  return Object.freeze({ scores: Object.freeze(scores), counts: Object.freeze(counts),
    scoreSum: scores.reduce((sum, score) => sum + score, 0) });
});

export function rescueScoreDistribution(formation) {
  return [...tables[formationOf(formation).id].counts];
}
export function rescuePayoutFor(wager, formation, outcome) {
  checkWager(wager);
  const table = tables[formationOf(formation).id];
  if (!Number.isInteger(outcome) || outcome < 0 || outcome >= RESCUE_OUTCOMES) throw new RangeError('Invalid rescue outcome');
  return wager * BigInt(table.scores[outcome]) * 69984n / (100n * BigInt(table.scoreSum));
}
export function rescueStatistics(formation, wager = 10000n) {
  checkWager(wager);
  const f = formationOf(formation), table = tables[f.id];
  const distribution = table.counts.flatMap((count, score) => count ? [{ score, count,
    payout: wager * BigInt(score) * 69984n / (100n * BigInt(table.scoreSum)) }] : []);
  const maxPayout = distribution.at(-1).payout;
  const topCount = distribution.filter(row => row.payout === maxPayout).reduce((sum, row) => sum + row.count, 0);
  const totalPayout = distribution.reduce((sum, row) => sum + row.payout * BigInt(row.count), 0n);
  const body = distribution.filter(row => row.payout < maxPayout);
  const bodySum = body.reduce((sum, row) => sum + row.payout * BigInt(row.count), 0n);
  const bodySquares = body.reduce((sum, row) => sum + row.payout ** 2n * BigInt(row.count), 0n);
  return { formation: f.id, wager, outcomeCount: RESCUE_OUTCOMES, scoreSum: table.scoreSum,
    distribution, totalPayout, maxPayout, expectedPayout: totalPayout / BigInt(RESCUE_OUTCOMES),
    probabilityWad: BigInt(topCount) * 10n ** 18n / BigInt(RESCUE_OUTCOMES),
    bodyVarianceScaled: (729n * bodySquares - bodySum ** 2n) * 10n ** 18n / (729n ** 2n),
    rtp: Number(totalPayout) / Number(wager * 729n) };
}
