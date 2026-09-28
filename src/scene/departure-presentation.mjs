import { projectGround } from '../../legacy-kinesis/src/projection.js';
export function shouldWaitForVanExit(van) {
  if (!van?.visible) return false;
  const point=projectGround(van);
  return point.x - (122 * 1480 / 788 * point.scale) / 2 <= 962;
}
export function advanceVanExitPresentation(van, seconds) {
  return {...van,x:van.x+480*Math.max(0,Math.min(seconds,.05)),facing:'right'};
}
