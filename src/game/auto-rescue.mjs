export const RESCUE_OUTCOMES = 729;
export const RESCUE_RULES_VERSION = 2;
export const RESCUE_FORMATIONS = Object.freeze([
  Object.freeze({ id: 0, key: 'bastion', name: 'Bastion', lanes: Object.freeze([1, 1, 1]) }),
  Object.freeze({ id: 1, key: 'sweep', name: 'Sweep', lanes: Object.freeze([0, 1, 2]) }),
]);

const CIVILIAN_LANES = [0, 1, 2, 0, 2];
const WAVE_CIVILIANS = [[0, 1], [2, 3], [4]];
const laneX = lane => 185 + lane * 365;

function formationOf(value) {
  const formation = RESCUE_FORMATIONS.find(item => value === item.id || value === item.key || value === item);
  if (!formation) throw new RangeError('Unknown rescue formation');
  return formation;
}

export function simulateRescue(formationValue, outcome) {
  const formation = formationOf(formationValue);
  if (!Number.isInteger(outcome) || outcome < 0 || outcome >= RESCUE_OUTCOMES) {
    throw new RangeError('Rescue outcome must be an integer in [0,728]');
  }

  const civilians = CIVILIAN_LANES.map((lane, index) => ({ id: `civilian-${index + 1}`, lane,
    hp: index === 0 || index === 2 ? 1 : 2, status: 'waiting' }));
  const shields = [{ id: 'starter-shield', capturedId: null, lane: formation.lanes[0], integrity: 3, status: 'orbit' }];
  const events = [], waves = [];
  let tick = 0, serial = 0, captures = 0, blocks = 0;
  const emit = (type, wave, sourceId, targetId, lane, state = '') => {
    events.push({ ordinal: events.length, tick: tick++, wave, type, sourceId, targetId, lane,
      x: laneX(lane), y: type === 'board' ? 350 : type === 'approach' ? 190 : 280, state });
  };
  const activeShield = () => [...shields].reverse().find(shield => shield.integrity > 0 && shield.status !== 'destroyed');

  for (let wave = 0; wave < 3; wave++) {
    const digit = Math.floor(outcome / 9 ** wave) % 9;
    const primaryLane = Math.floor(digit / 3), pattern = digit % 3;
    const guardLane = formation.lanes[wave];
    const group = WAVE_CIVILIANS[wave].map(index => civilians[index]);
    for (const civilian of group) {
      civilian.status = 'walking';
      emit('civilian-enter', wave, civilian.id, 'exit', civilian.lane, 'walking');
    }
    const enemies = Array.from({ length: pattern + 2 }, (_, index) => {
      const heavy = pattern > 0 && index === pattern + 1;
      const lane = index === 0 ? primaryLane : (primaryLane + index + wave) % 3;
      return { id: `enemy-${++serial}`, lane, kind: heavy ? 'heavy' : 'weak', armorHits: 0,
        armorHitsToBreak: heavy ? 2 : 1, status: 'approaching' };
    });
    // The hero commits to one capture target per wave. Other living enemies fire and retreat.
    const captureTarget = enemies.find(enemy => enemy.lane === guardLane) ?? enemies[0];
    const ordered = [captureTarget, ...enemies.filter(enemy => enemy !== captureTarget)];
    // Like the courtyard rescue, the whole group enters from several gates and
    // advances into throwing range before any one attacker resolves combat.
    for (const enemy of enemies) emit('spawn', wave, enemy.id, null, enemy.lane, enemy.kind);
    for (const enemy of enemies) emit('approach', wave, enemy.id, 'shield-edge', enemy.lane, 'throwable-standoff');
    for (const enemy of ordered) {
      let projectile = activeShield();
      if (projectile) {
        projectile.lane = guardLane;
        projectile.status = 'placed';
        emit('place', wave, projectile.id, 'shelter-position', guardLane, String(projectile.integrity));
      }
      const preempt = enemy === captureTarget && enemy.lane === guardLane && projectile;
      if (preempt) {
        for (let hit = 0; hit < enemy.armorHitsToBreak; hit++) {
          emit('throw', wave, projectile.id, enemy.id, enemy.lane, 'armor');
          enemy.armorHits++;
          emit('armor-hit', wave, enemy.id, projectile.id, enemy.lane, String(enemy.armorHits));
          if (enemy.armorHits === enemy.armorHitsToBreak) emit('armor-break', wave, enemy.id, null, enemy.lane, 'broken');
          emit('return', wave, projectile.id, 'hero', enemy.lane, 'same-shield');
        }
      }
      const threatened = group.find(civilian => civilian.status === 'walking');
      emit('shot', wave, enemy.id, threatened?.id ?? projectile?.id ?? 'exit', enemy.lane, 'fired');
      if (projectile && projectile.integrity > 0 && enemy.lane === guardLane) {
        projectile.integrity--;
        blocks++;
        emit('block', wave, projectile.id, enemy.id, guardLane, String(projectile.integrity));
        if (!projectile.integrity) {
          projectile.status = 'destroyed';
          emit('shield-break', wave, projectile.id, null, guardLane, 'destroyed');
        }
      } else if (threatened) {
        threatened.hp--;
        emit('civilian-hit', wave, threatened.id, enemy.id, threatened.lane, String(threatened.hp));
        if (threatened.hp === 0) {
          threatened.status = 'lost';
          emit('civilian-lost', wave, threatened.id, enemy.id, threatened.lane, 'lost');
        }
      } else {
        emit('miss', wave, enemy.id, 'exit', enemy.lane, 'no-target');
      }

      if (enemy === captureTarget && (projectile = activeShield())) {
        if (!preempt) {
          for (let hit = 0; hit < enemy.armorHitsToBreak; hit++) {
            emit('throw', wave, projectile.id, enemy.id, enemy.lane, 'armor');
            enemy.armorHits++;
            emit('armor-hit', wave, enemy.id, projectile.id, enemy.lane, String(enemy.armorHits));
            if (enemy.armorHits === enemy.armorHitsToBreak) emit('armor-break', wave, enemy.id, null, enemy.lane, 'broken');
            emit('return', wave, projectile.id, 'hero', enemy.lane, 'same-shield');
          }
        }
        emit('throw', wave, projectile.id, enemy.id, enemy.lane, 'capture');
        enemy.status = 'captured';
        captures++;
        emit('capture', wave, enemy.id, projectile.id, enemy.lane, 'captured');
        const capturedShield = { id: `shield-${enemy.id}`, capturedId: enemy.id, lane: enemy.lane,
          integrity: enemy.kind === 'heavy' ? 3 : 2, status: 'returning' };
        shields.push(capturedShield);
        emit('return', wave, enemy.id, 'hero', enemy.lane, 'captured-shield');
        capturedShield.status = 'orbit';
      } else {
        enemy.status = 'retreated';
        emit('retreat', wave, enemy.id, null, enemy.lane, 'alive');
      }
    }
    for (const civilian of group) if (civilian.status === 'walking') {
      civilian.status = 'boarded';
      emit('board', wave, civilian.id, 'exit', civilian.lane, 'boarded');
    }
    waves.push({ index: wave, guardLane, enemies: enemies.map(enemy => ({ ...enemy })) });
  }
  const boarded = civilians.filter(civilian => civilian.status === 'boarded').length;
  const score = boarded ? 2 * boarded + captures + blocks : 0;
  return { formation: formation.id, outcome, civilians, waves, shields, events, boarded, captures, blocks, score };
}
