import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldWaitForVanExit, advanceVanExitPresentation } from '../src/scene/departure-presentation.mjs';
test('departed vehicle remains gated until its full rendered width clears the arena', () => {
  const van = { x:1035,y:300,visible:true,phase:'departed' };
  assert.equal(shouldWaitForVanExit(van),true);
  let next=van;
  for(let i=0;i<120 && shouldWaitForVanExit(next);i++) next=advanceVanExitPresentation(next,1/60);
  assert.equal(shouldWaitForVanExit(next),false);
  assert.equal(van.x,1035);
});
test('missing or invisible vehicles do not block results',()=>{
  assert.equal(shouldWaitForVanExit(null),false);
  assert.equal(shouldWaitForVanExit({visible:false,x:480,y:300}),false);
});
