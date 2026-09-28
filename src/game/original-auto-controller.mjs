import { activeCivilian } from '../../legacy-kinesis/src/content/rescue.js';
import { angleDelta } from '../../legacy-kinesis/src/geometry.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function originalAutoCommands(state) {
  if (state.status !== 'running' || !state.tactical) return [];
  const rescue = state.rescue;
  if (rescue.phase === 'choice') {
    return [{ type: rescue.boarded >= rescue.goal || rescue.optional ? 'depart' : 'stay' }];
  }
  if (rescue.phase === 'boarding' && rescue.boarded >= rescue.goal) return [{ type: 'depart' }];
  if (rescue.phase === 'departing') return [];

  const civilians = rescue.npcs.filter(activeCivilian);
  const threat = [...state.enemies].sort((a, b) => {
    const risk = enemy => civilians.length
      ? Math.min(...civilians.map(civilian => distance(enemy, civilian)))
      : distance(enemy, state.player);
    return risk(a) - risk(b) || distance(a, state.player) - distance(b, state.player);
  })[0];
  const held = state.covers.find(cover => cover.status === 'held');
  if (held && threat) {
    const angle = Math.atan2(threat.y - state.player.y, threat.x - state.player.x);
    const aim = { type: 'aim', x: state.player.x + Math.cos(angle) * 340,
      y: state.player.y + Math.sin(angle) * 340 };
    const coverAngle = Math.atan2(held.y - state.player.y, held.x - state.player.x);
    return Math.abs(angleDelta(angle, coverAngle)) < .12 ? [aim, { type: 'release' }] : [aim];
  }
  if (held) return [{ type: 'aim', x: rescue.exit.x - 150, y: rescue.exit.y }, { type: 'place' }];
  const ready = state.covers.filter(cover => cover.status === 'orbit' && cover.hp > 0)
    .sort((a, b) => Number(a.id !== 1) - Number(b.id !== 1) || b.hp - a.hp)[0];
  if (threat && ready) return [{ type: 'hold', id: ready.id }];
  const damaged = state.covers.some(cover => cover.hp < cover.maxHp / 2);
  if (damaged && rescue.kits > 0 && state.tick >= rescue.repairReadyAt) return [{ type: 'repair' }];
  return [];
}
