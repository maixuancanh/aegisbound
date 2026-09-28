import { createOriginalRunner } from './original-runner.mjs';
import { originalAutoCommands } from './original-auto-controller.mjs';
import { createShortQuickPlay, SHORT_ROUND_LIMIT } from './short-quick-play.mjs';

export const ORIGINAL_OUTCOME_COUNT = 729;
export const ORIGINAL_SEED_COUNT = 27;
export const ORIGINAL_RULES_VERSION = 4;
export const ORIGINAL_CADENCE = Object.freeze([50, 52]);

export function originalScenarioCommands(state, formation) {
  if (formation !== 0 && formation !== 1) throw new RangeError('Invalid formation');
  if (state.rescue?.shortRound && state.rescue.phase === 'choice') return [{ type: 'depart' }];
  const commands = originalAutoCommands(state);
  if (commands.some(command => command.type === 'hold') && state.tick % ORIGINAL_CADENCE[formation] !== 0) return [];
  return commands;
}

export function createOriginalScenario(formation, outcomeIndex) {
  if (formation !== 0 && formation !== 1) throw new RangeError('Invalid formation');
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= ORIGINAL_OUTCOME_COUNT) {
    throw new RangeError('Invalid outcome');
  }
  return createShortQuickPlay(outcomeIndex % ORIGINAL_SEED_COUNT + 1, formation);
}

export function summarizeOriginalScenario(formation, outcomeIndex) {
  const runner = createOriginalScenario(formation, outcomeIndex);
  const counts = { captures: 0, blocks: 0, throws: 0 };
  while (runner.state.status === 'running' && runner.state.tick < SHORT_ROUND_LIMIT) {
    const result = runner.advance(originalScenarioCommands(runner.state, formation));
    for (const event of result.events) {
      if (event.type === 'capture') counts.captures++;
      if (event.type === 'block') counts.blocks++;
      if (event.type === 'throw') counts.throws++;
    }
  }
  if (runner.state.status === 'running') throw Error('Short rescue scenario did not finish');
  return { formation, outcomeIndex, seed: outcomeIndex % ORIGINAL_SEED_COUNT + 1,
    status: runner.state.status, tick: runner.state.tick,
    boarded: runner.state.rescue.boarded, lost: runner.state.rescue.lost,
    ...counts };
}
