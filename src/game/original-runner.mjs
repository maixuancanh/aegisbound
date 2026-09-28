import { createRun, stepRun } from '../../legacy-kinesis/src/engine.js';

export function createOriginalRunner(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('Quick Play seed must be a uint32 greater than zero');
  }
  let state = createRun({ mode: 'rescue', seed });
  return {
    get state() { return state; },
    advance(commands = []) {
      const result = stepRun(state, commands);
      state = result.state;
      return result;
    },
  };
}
