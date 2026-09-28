import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { encodeAbiParameters, decodeAbiParameters, keccak256 } from 'viem';
import { originalPayoutFor as payoutFor, originalStatistics as statistics,
  originalScoreFor as scoreFor } from '../src/game/original-outcome-table.mjs';
import { ORIGINAL_RULES_VERSION as RESCUE_RULES_VERSION } from '../src/game/original-scenario.mjs';

// Replace only the iframe transport; exercise the actual adapter and ABI/math.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@chain/casino-sdk/guest') return { shortCircuit: true,
    url: 'data:text/javascript,export const connectGameToHost = m => globalThis.__bridgeTransport(m);' };
  return next(specifier, context);
} });
const tick = () => new Promise(resolve => setImmediate(resolve));
const uint = [{ type: 'uint256' }];
const game = '0x' + '11'.repeat(20), wallet = '0x' + '22'.repeat(20);
let serial = 0;
function snapshot(items = []) { return {
  apiVersion: 1, integration: { chainId: 31337, gameAddress: game },
  wallet: { status: 'ready', address: wallet }, token: { decimals: 18 },
  balances: { smartVaultBalance: '1000000' }, casino: { maxAllowedReservedProfit: '1000000', maxBetAmount: '10000' },
  sessions: { items },
}; }
function row(id = '1', settled = false) { return {
  sessionId: id, sessionKey: `31337:${id}`, gameAddress: game, wager: '100',
  phase: settled ? 3 : 1, isSettled: settled, payout: settled ? payoutFor(100n, 0, 3).toString() : undefined,
  raw: { gameData: encodeAbiParameters(uint, [0n]),
    gameState: settled ? encodeAbiParameters([{type:'uint8'}, {type:'uint8'}, {type:'uint32'}, {type:'uint256'}, {type:'uint8'}, {type:'bytes32'}],
      [3, 0, 2, 3n, RESCUE_RULES_VERSION, keccak256(encodeAbiParameters([{type:'uint8'}, {type:'uint8'}, {type:'uint256'}, {type:'uint256'}],
        [RESCUE_RULES_VERSION, 0, 3n, BigInt(scoreFor(0,3))]))]) : '0x' },
}; }
async function harness({ storage = new Map(), iframe = true, open } = {}) {
  let methods, connections = 0;
  const opens = [], reveals = [], rounds = [], statuses = [];
  globalThis.window = { parent: {} };
  if (!iframe) window.parent = window;
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.__bridgeTransport = m => {
    methods = m; connections++;
    return { promise: Promise.resolve({
      openSession: async input => { opens.push(input); return open ? open(input) : { sessionKey: '31337:1', transactionHash: '0x12' }; },
      revealOutcome: async input => reveals.push(input),
    }) };
  };
  const module = await import(`../src/bridge.mjs?test=${serial++}`).catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof module.createBridge, 'function', 'createBridge export missing');
  const create = callbacks => module.createBridge({ onSnapshot() {}, onStatus: s => statuses.push(s), onRound: r => rounds.push(r), ...callbacks });
  const bridge = create(); await tick();
  return { bridge, create, opens, reveals, rounds, statuses, storage,
    connections: () => connections,
    async push(s) { await methods.setState(s); await tick(); },
  };
}

test('standalone never connects or opens; close prevents calls', async () => {
  const h = await harness({ iframe: false });
  assert.equal(h.connections(), 0);
  await assert.rejects(h.bridge.cast(100n, 0));
  h.bridge.close(); await assert.rejects(h.bridge.cast(100n, 0));
});
test('one connection and one open across mounts; uint256 input and key matching', async () => {
  const h = await harness(); const other = h.create();
  await h.push(snapshot());
  await h.bridge.cast(100n, 1);
  assert.deepEqual(decodeAbiParameters(uint, h.opens[0].gameData), [1n]);
  await assert.rejects(other.cast(100n, 0));
  await h.push(snapshot([row('2', true)]));
  assert.equal(h.rounds.length, 0); assert.equal(h.connections(), 1);
  h.bridge.close(); other.close();
});
test('wallet, unknown/malformed limits, balance, domain and exact risk cap fail closed', async () => {
  const h = await harness();
  for (const change of [s => s.wallet.status = 'disconnected', s => delete s.casino,
    s => delete s.balances.smartVaultBalance, s => s.balances.smartVaultBalance = '99',
    s => s.casino.maxAllowedReservedProfit = 'bad', s => s.casino.maxBetAmount = '99',
    s => s.casino.maxAllowedReservedProfit = (statistics(0,100n).maxPayout - 101n).toString()]) {
    const s = snapshot(); change(s); await h.push(s); await assert.rejects(h.bridge.cast(100n, 0));
  }
  await h.push(snapshot());
  for (const [w,f] of [[100,0],[99n,0],[100n,2],[100n,NaN]]) await assert.rejects(h.bridge.cast(w,f));
  assert.equal(h.opens.length, 0); h.bridge.close();
});
test('reveal waits for asynchronous round presentation; duplicate pushes do not replay', async () => {
  const h = await harness(); h.bridge.close();
  let finish; const presented = new Promise(resolve => finish = resolve);
  const b = h.create({ onRound: async r => { h.rounds.push(r); await presented; } });
  await h.push(snapshot()); await b.cast(100n, 0);
  await h.push(snapshot([row('1',true)])); await h.push(snapshot([row('1',true)]));
  assert.equal(h.rounds.length, 1); assert.equal(h.reveals.length, 0);
  assert.deepEqual(h.rounds[0], {sessionId:'1',wager:100n,payout:payoutFor(100n,0,3),formation:0,outcomeIndex:3});
  finish(); await tick(); assert.deepEqual(h.reveals, [{ sessionId:'1' }]); b.close();
});
test('reload recovers pending and journalled settled rounds without another open', async () => {
  const first = await harness(); await first.push(snapshot()); await first.bridge.cast(100n,0); first.bridge.close();
  const h = await harness({storage:first.storage});
  await h.push(snapshot([row('1',true)]));
  assert.equal(h.opens.length,0); assert.equal(h.rounds.length,1); assert.equal(h.reveals.length,1);
  h.bridge.close();
  const recovered = await harness(); await recovered.push(snapshot([row()]));
  await assert.rejects(recovered.bridge.cast(100n,0));
  await recovered.push(snapshot([row('1',true)])); assert.equal(recovered.rounds.length,1); recovered.bridge.close();
});
test('history is not replayed; corrupt settlement never fabricates outcome or reveals', async () => {
  const h = await harness(); await h.push(snapshot([row('8',true)])); assert.equal(h.rounds.length,0);
  await h.bridge.cast(100n,0); const bad = row('1',true); bad.raw.gameState = '0x';
  await h.push(snapshot([bad])); assert.equal(h.rounds.length,0); assert.equal(h.reveals.length,0);
  await assert.rejects(h.bridge.cast(100n,0)); h.bridge.close();
});
test('wrong replay commitment never presents or reveals a settlement', async () => {
  const h = await harness(); await h.push(snapshot()); await h.bridge.cast(100n,0);
  const bad = row('1',true);
  bad.raw.gameState = bad.raw.gameState.slice(0,-64) + '00'.repeat(32);
  await h.push(snapshot([bad]));
  assert.equal(h.rounds.length,0); assert.equal(h.reveals.length,0);
  h.bridge.close();
});
test('ambiguous open failure remains locked across reload; no automatic retry', async () => {
  const h = await harness({open:async()=>{throw Error('transport lost');}});
  await h.push(snapshot()); await assert.rejects(h.bridge.cast(100n,0));
  await assert.rejects(h.bridge.cast(100n,0)); assert.equal(h.opens.length,1); h.bridge.close();
  const next = await harness({storage:h.storage}); await next.push(snapshot());
  await assert.rejects(next.bridge.cast(100n,0)); next.bridge.close();
});
test('callback rejection and close during presentation do not reveal', async () => {
  const h = await harness(); h.bridge.close();
  const b = h.create({onRound:async()=>{throw Error('render failed');}});
  await h.push(snapshot()); await b.cast(100n,0); await h.push(snapshot([row('1',true)]));
  assert.equal(h.reveals.length,0); await assert.rejects(b.cast(100n,0)); b.close();
});
