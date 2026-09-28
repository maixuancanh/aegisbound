// Local SDK EVM only. Exhaustively compare the automatic rescue contract to the JS reference.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ORIGINAL_BOARDED, originalPayoutFor, originalStatistics, originalScoreFor } from '../src/game/original-outcome-table.mjs';
import { ORIGINAL_RULES_VERSION } from '../src/game/original-scenario.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sdk = resolve(root, 'vendor/chain-sdk/casino-sdk');
const require = createRequire(resolve(sdk, 'package.json'));
const solc = require('solc');
const { createPublicClient, createWalletClient, custom, encodeAbiParameters, decodeAbiParameters, keccak256 } = require('viem');
const sourceName = 'contracts/BorrowedAegisAuto.sol';
const input = { language: 'Solidity', sources: { [sourceName]: { content: readFileSync(resolve(root, sourceName), 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: path => {
  try { return { contents: readFileSync(resolve(root, path), 'utf8') }; }
  catch { return { error: `Missing import ${path}` }; }
} }));
assert.equal((output.errors ?? []).filter(error => error.severity === 'error').length, 0, JSON.stringify(output.errors));
const artifact = output.contracts[sourceName].BorrowedAegisAuto;
const bytes = artifact.evm.deployedBytecode.object.length / 2;
assert.ok(bytes < 24576, `Contract exceeds EIP-170: ${bytes} bytes`);
process.chdir(resolve(sdk, 'simulator'));
const { network } = await import(pathToFileURL(require.resolve('hardhat')).href);
const connection = await network.create();
try {
  const client = createPublicClient({ transport: custom(connection.provider) });
  const [account] = await connection.provider.request({ method: 'eth_accounts' });
  const wallet = createWalletClient({ account, transport: custom(connection.provider) });
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}`, chain: null });
  const { contractAddress: address } = await client.waitForTransactionReceipt({ hash });
  const call = (functionName, args = []) => client.readContract({ address, abi: artifact.abi, functionName, args });
  assert.equal(await call('rulesVersion'), ORIGINAL_RULES_VERSION);
  for (const formation of [0, 1]) {
    const counts = Array.from({ length: 6 }, (_, boarded) => ORIGINAL_BOARDED[formation].filter(number => number === boarded).length * 27);
    assert.deepEqual((await call('distribution', [formation])).map(Number), counts);
  }
  const wager = 10000n;
  const formationData = encodeAbiParameters([{ type: 'uint256' }], [0n]);
  const context = { sessionId: 1n, player: account, vault: account, wagerBase: wager,
    escrowedStake: wager, reservedProfit: 0n, step: 0, gameData: formationData, gameState: '0x' };
  const start = await call('onSessionStart', [context]);
  assert.equal(start.nextPhase, 1);
  assert.equal(start.requestRandomnessNow, true);
  const reserve = originalStatistics(0, wager).maxPayout - wager;
  assert.equal(start.reservedProfitDelta, reserve);
  const waiting = { ...context, reservedProfit: reserve, step: 1, gameState: start.newGameState };
  const stateTypes = [{ type: 'uint8' }, { type: 'uint8' }, { type: 'uint32' },
    { type: 'uint256' }, { type: 'uint8' }, { type: 'bytes32' }];
  const commitmentTypes = [{ type: 'uint8' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }];
  const retry = await call('onRandomness', [waiting, `0x${'0'.repeat(64)}`]);
  assert.equal(retry.nextPhase, 1);
  assert.equal(retry.requestRandomnessNow, true);
  for (const outcome of [0, 3, 728]) {
    const random = `0x${(729n + BigInt(outcome)).toString(16).padStart(64, '0')}`;
    const settled = await call('onRandomness', [waiting, random]);
    assert.equal(settled.nextPhase, 3);
    assert.equal(settled.payout, originalPayoutFor(wager, 0, outcome));
    const [phase, formation, step, value, version, commitment] = decodeAbiParameters(stateTypes, settled.newGameState);
    assert.deepEqual([phase, formation, step, value, version], [3, 0, 2, BigInt(outcome), ORIGINAL_RULES_VERSION]);
    const expected = keccak256(encodeAbiParameters(commitmentTypes,
      [ORIGINAL_RULES_VERSION, 0, BigInt(outcome), BigInt(originalScoreFor(0, outcome))]));
    assert.equal(commitment, expected);
  }
  let checked = 0;
  for (const formation of [0, 1]) {
    for (let outcome = 0; outcome < 729; outcome++) {
      assert.equal(await call('scoreFor', [formation, BigInt(outcome)]), BigInt(originalScoreFor(formation, outcome)),
        `score: formation=${formation} outcome=${outcome}`);
      for (const wager of [100n, 10000n, 10n ** 24n]) {
        assert.equal(await call('payoutFor', [wager, formation, BigInt(outcome)]), originalPayoutFor(wager, formation, outcome),
          `payout: formation=${formation} outcome=${outcome} wager=${wager}`);
        checked++;
      }
    }
    for (const wager of [100n, 101n, 10000n, 10n ** 24n]) {
      const stats = originalStatistics(formation, wager);
      const data = encodeAbiParameters([{type:'uint256'}], [BigInt(formation)]);
      assert.deepEqual(await call('quoteCaps', [wager, data]), [wager, stats.maxPayout - wager]);
      assert.deepEqual(await call('quoteRiskParams', [wager, data]),
        [stats.maxPayout, stats.probabilityWad, stats.expectedPayout, stats.bodyVarianceScaled]);
    }
  }
  console.log(`PASS auto rescue parity: ${checked} payouts, 1458 scores, risk quotes, session settlement and commitments, ${bytes} runtime bytes`);
} finally { await connection.close(); }
