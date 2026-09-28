import { createRun, stepRun } from '../../legacy-kinesis/src/engine.js';
import { addCivilianGroup } from '../../legacy-kinesis/src/rescue.js';
import { spawnEnemy } from '../../legacy-kinesis/src/enemies.js';
import { stageProfileFor } from '../../legacy-kinesis/src/stage-layout.js';

export const SHORT_ROUND_DEADLINE = 480;
export const SHORT_ROUND_LIMIT = 600;
const ARRIVALS = [55, 235];

function createShortState(seed, formation) {
  const state = createRun({ mode: 'rescue', seed, durationTicks: SHORT_ROUND_DEADLINE });
  const rescue = state.rescue;
  const profile = stageProfileFor(state);
  const start = { x: 350, y: profile.taxi.dock.y };
  const route = [start, { x: 690, y: start.y }, { x: 788, y: start.y }];
  rescue.npcs = [];
  rescue.nextNpc = 1;
  rescue.nextGroupId = 1;
  rescue.routes = [route];
  addCivilianGroup(rescue, 0, 5, false, 0);
  for (const [index, npc] of rescue.npcs.entries()) {
    npc.spawnAt = index * 60;
    npc.speed = 76 + (seed - 1) * 4 - formation * 8;
    npc.variant = index;
  }
  rescue.groups = 1;
  rescue.maxGroups = 1;
  rescue.nextGroupAt = Infinity;
  rescue.nextSpawnAt = Infinity;
  rescue.openingThreatsPending = false;
  rescue.nextTacticAt = Infinity;
  rescue.nextCommanderAt = Infinity;
  rescue.nextIncidentAt = Infinity;
  rescue.nextKitAt = Infinity;
  rescue.arrivalAt = 30;
  rescue.deadline = SHORT_ROUND_DEADLINE;
  rescue.shortRound = true;
  state.durationTicks = SHORT_ROUND_DEADLINE;
  return state;
}

function makeEnemy(state, index) {
  const profile = stageProfileFor(state);
  const heavy = index === 1;
  const archetype = heavy ? 'Warden' : 'Spitter';
  const entry = profile.enemyEntries[index];
  const enemy = spawnEnemy({ archetype, angle: 0, distance: 0, speed: 0 }, state.tick, `short-${index + 1}`);
  Object.assign(enemy, entry, {
    baseX: entry.x, baseY: entry.y,
    role: heavy ? 'breaker' : 'hunter',
    nextShot: state.tick + 48,
    hp: heavy ? 2 : 1, maxHp: heavy ? 2 : 1,
    speed: heavy ? 28 : 32, flankSign: index === 0 ? -1 : 1,
    nextBodyAt: 0, stunnedUntil: 0, knockVx: 0, knockVy: 0,
    animationPhase: index * 40,
    armor: 'intact', guard: heavy ? 'closed' : 'open', guardUntil: 0,
    entryTarget: profile.enemyApproaches[index],
  });
  return enemy;
}

export function createShortQuickPlay(seed, formation = 0) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('Quick Play seed must be a uint32 greater than zero');
  }
  if (formation !== 0 && formation !== 1) throw new RangeError('Invalid formation');
  let state = createShortState(seed, formation);
  return {
    get state() { return state; },
    advance(commands = []) {
      if (state.status !== 'running') return { state, events: [] };
      const index = ARRIVALS.indexOf(state.tick);
      let arrival = null;
      if (index >= 0) {
        state = structuredClone(state);
        arrival = makeEnemy(state, index);
        state.enemies.push(arrival);
      }
      const result = stepRun(state, commands);
      state = result.state;
      if (arrival) result.events.unshift({ type: 'short-spawn', enemyId: arrival.id, archetype: arrival.archetype });
      return result;
    },
  };
}
