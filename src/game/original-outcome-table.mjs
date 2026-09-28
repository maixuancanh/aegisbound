// Exhaustively measured from the Chain Jam short Quick Play, seeds 1..27.
// Regenerate only after intentional changes to its versioned round profile.
export const ORIGINAL_BOARDED = Object.freeze([
  Object.freeze([1,1,2,2,2,2,3,3,3,3,3,3,4,5,5,4,4,4,4,4,5,5,5,5,5,5,5]),
  Object.freeze([0,0,1,1,2,2,2,2,3,3,3,3,3,3,4,5,5,4,4,4,4,4,5,5,5,5,5]),
]);
export const ORIGINAL_BOARDING_SCORE = Object.freeze([0, 1, 3, 7, 15, 40]);

export function originalBoardedFor(formation, outcomeIndex) {
  if (formation !== 0 && formation !== 1) throw new RangeError('Invalid formation');
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= 729) throw new RangeError('Invalid outcome');
  return ORIGINAL_BOARDED[formation][outcomeIndex % 27];
}

export function originalScoreFor(formation, outcomeIndex) {
  return ORIGINAL_BOARDING_SCORE[originalBoardedFor(formation, outcomeIndex)];
}

export const ORIGINAL_SCORE_SUM = Object.freeze(ORIGINAL_BOARDED.map(row =>
  row.reduce((sum, boarded) => sum + ORIGINAL_BOARDING_SCORE[boarded], 0)));

export function originalPayoutFor(wager, formation, outcomeIndex) {
  if (typeof wager !== 'bigint' || wager < 100n || wager > 10n ** 24n) throw new RangeError('Invalid wager');
  return wager * BigInt(originalScoreFor(formation, outcomeIndex)) * 2565n /
    (100n * BigInt(ORIGINAL_SCORE_SUM[formation]));
}

export function originalStatistics(formation, wager = 10000n) {
  if (formation !== 0 && formation !== 1) throw new RangeError('Invalid formation');
  const counts = ORIGINAL_BOARDING_SCORE.map((_, boarded) => ORIGINAL_BOARDED[formation].filter(n => n === boarded).length * 27);
  const distribution = counts.flatMap((count, boarded) => count ? [{ boarded, score: ORIGINAL_BOARDING_SCORE[boarded], count,
    payout: originalPayoutFor(wager, formation, ORIGINAL_BOARDED[formation].indexOf(boarded)) }] : []);
  const maxPayout = originalPayoutFor(wager, formation, ORIGINAL_BOARDED[formation].indexOf(5));
  const topCount = counts[5];
  const totalPayout = distribution.reduce((sum, row) => sum + row.payout * BigInt(row.count), 0n);
  const body = distribution.filter(row => row.payout < maxPayout);
  const bodySum = body.reduce((sum, row) => sum + row.payout * BigInt(row.count), 0n);
  const bodySquares = body.reduce((sum, row) => sum + row.payout ** 2n * BigInt(row.count), 0n);
  return { formation, wager, outcomeCount: 729, distribution, maxPayout,
    expectedPayout: totalPayout / 729n, probabilityWad: BigInt(topCount) * 10n ** 18n / 729n,
    bodyVarianceScaled: (729n * bodySquares - bodySum ** 2n) * 10n ** 18n / 729n ** 2n,
    rtp: Number(totalPayout) / Number(wager * 729n) };
}
