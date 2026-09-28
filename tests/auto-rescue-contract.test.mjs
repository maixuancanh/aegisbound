import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the automatic rescue contract exposes its deterministic score and trace version', () => {
  const source = readFileSync(new URL('../contracts/BorrowedAegisAuto.sol', import.meta.url), 'utf8');
  assert.match(source, /contract BorrowedAegisAuto is ICasinoGameV2/);
  assert.match(source, /function scoreFor\(/);
  assert.match(source, /function rulesVersion\(/);
  assert.match(source, /rulesVersion\(\) external pure returns \(uint8\) \{ return 4; \}/);
  assert.match(source, /function boardedFor\(/);
});
