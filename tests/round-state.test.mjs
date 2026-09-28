import test from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../src/round-state.mjs').catch(() => ({}));
test('round controller prevents double bets and settles once', async () => {
 const {createRoundState}=await load(); assert.equal(typeof createRoundState,'function');
 const s=createRoundState(10000n); s.start(100n,0); assert.throws(()=>s.start(100n,0));
 assert.equal(s.balance,9900n); s.settle(200n); assert.equal(s.balance,10100n); assert.throws(()=>s.settle(200n));
});
test('invalid bets leave the balance untouched',async()=>{
 const {createRoundState}=await load(); assert.equal(typeof createRoundState,'function');
 const s=createRoundState(10000n);
 for(const bet of [0n,99n,10001n,-1n]) assert.throws(()=>s.start(bet,0));
 assert.equal(s.balance,10000n); assert.equal(s.phase,'ready');
});
test('demo outcome sampler rejects the biased remainder',async()=>{
 const {sampleOutcome}=await load(); assert.equal(typeof sampleOutcome,'function');
 const values=[4294967295,728]; assert.equal(sampleOutcome(()=>values.shift()),728);
});
