import test from 'node:test';
import assert from 'node:assert/strict';
test('decimal amounts use token precision without floating point',async()=>{
 const m=await import('../src/amounts.mjs').catch(()=>({}));assert.equal(typeof m.parseAmount,'function');
 assert.equal(m.parseAmount('10.25',18),10250000000000000000n);
 assert.equal(m.parseAmount('1.01',2),101n);
 assert.equal(m.formatAmount(10250000000000000000n,18),'10.25');
 assert.equal(m.formatAmount(100n,18),'0.0000000000000001');
 for(const value of ['-1','1e2','NaN','0.001'])assert.throws(()=>m.parseAmount(value,2));
});
