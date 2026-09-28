export function idlePresentationTick(startedAt, now) {
  return Math.max(0, Math.floor((now - startedAt) * 60 / 1000));
}
