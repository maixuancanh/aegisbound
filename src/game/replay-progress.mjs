export function replayProgress(completed, total) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, completed / total));
}
