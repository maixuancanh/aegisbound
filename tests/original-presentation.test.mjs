import test from 'node:test';
import assert from 'node:assert/strict';
import { idlePresentationTick } from '../src/scene/original-presentation.mjs';
import { spritePresentation } from '../src/scene/original-character-art.mjs';

test('idle VFX clock advances without advancing the scenario state', () => {
  const state = { tick: 0, covers: [{ status: 'orbit' }] };
  assert.equal(idlePresentationTick(1000, 1000), 0);
  assert.equal(idlePresentationTick(1000, 1200), 12);
  assert.equal(state.tick, 0);
});

test('civilian sprites face their direction of travel and cycle while moving', () => {
  const civilian = { id: 'civilian-1', status: 'to-vehicle', facing: 'right' };
  const first = spritePresentation(civilian, 0, 'civilian');
  const second = spritePresentation(civilian, 12, 'civilian');
  assert.equal(first.flip, false);
  assert.notEqual(first.frame, second.frame);
  assert.equal(spritePresentation({ ...civilian, facing: 'left' }, 0, 'civilian').flip, true);
  assert.equal(spritePresentation({ ...civilian, status: 'boarding' }, 12, 'civilian').frame, 'walk');
});

test('moving enemy sprites cycle, stationary enemies attack only while telegraphing', () => {
  const advancing = { id: 'enemy-1', vx: -20, vy: 0 };
  assert.notEqual(spritePresentation(advancing, 0, 'enemy').frame,
    spritePresentation(advancing, 12, 'enemy').frame);
  assert.equal(spritePresentation({ ...advancing, vx: 0 }, 12, 'enemy').frame, 'advance');
  assert.equal(spritePresentation({ ...advancing, vx: 0, telegraph: {} }, 12, 'enemy').frame, 'attack');
});
