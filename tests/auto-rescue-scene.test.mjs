import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateRescue } from '../src/game/auto-rescue.mjs';
import * as scene from '../src/scene/auto-rescue-scene.mjs';
const { projectReplay, eventCue } = scene;

test('canvas backing resolution follows display width instead of a fixed 1100px', () => {
  assert.deepEqual(scene.canvasBackingSize(819, 1), { width: 819, height: 313 });
  assert.deepEqual(scene.canvasBackingSize(819, 2), { width: 1638, height: 625 });
  assert.deepEqual(scene.canvasBackingSize(1100, 1), { width: 1100, height: 420 });
});

test('enemy frames come from three separate sheets without shared grid cells', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/assets/auto-rescue-enemy-atlas-v2.json', import.meta.url)));
  assert.deepEqual(Object.keys(atlas.enemies).sort(), ['beast', 'heavy', 'rogue']);
  for (const [type, enemy] of Object.entries(atlas.enemies)) {
    assert.match(enemy.image, new RegExp(`auto-rescue-${type}-enemy-v2\\.png$`));
    const { advance, attack } = enemy.frames;
    assert.ok(advance.x + advance.w < attack.x, `${type} poses overlap`);
    for (const frame of [advance, attack]) {
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.w > 0 && frame.h > 0);
      assert.ok(frame.x + frame.w <= enemy.size.w && frame.y + frame.h <= enemy.size.h);
    }
  }
  assert.equal(scene.enemyAssetKey('heavy', 'enemy-2'), 'heavy');
  assert.equal(scene.enemyAssetKey('weak', 'enemy-1'), 'rogue');
  assert.equal(scene.enemyAssetKey('weak', 'enemy-2'), 'beast');
  assert.equal(scene.enemyFrameName('attacking'), 'attack');
  assert.equal(scene.enemyFrameName('approaching'), 'advance');
});

test('each civilian has its own transparent sheet and two non-overlapping atlas frames', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/assets/auto-rescue-civilian-atlas-v2.json', import.meta.url)));
  assert.equal(atlas.civilians.length, 5);
  for (const [index, civilian] of atlas.civilians.entries()) {
    assert.equal(civilian.image, `auto-rescue-civilian-${index + 1}-v2.png`);
    const [walk, run] = [civilian.frames.walk, civilian.frames.run];
    assert.ok(walk.x >= 0 && walk.y >= 0 && run.x >= 0 && run.y >= 0);
    assert.ok(walk.x + walk.w < run.x, 'poses have a transparent gutter');
    for (const frame of [walk, run]) {
      assert.ok(frame.w > 0 && frame.h > 0);
      assert.ok(frame.x + frame.w <= civilian.size.w);
      assert.ok(frame.y + frame.h <= civilian.size.h);
    }
  }
  assert.equal(scene.civilianFrameName(0), 'walk');
  assert.equal(scene.civilianFrameName(1), 'run');
});

test('guardian Phaser atlas maps each combat pose and preserves frame bounds', () => {
  const atlas = JSON.parse(readFileSync(new URL('../public/assets/auto-rescue-guardian-atlas-v2.json', import.meta.url)));
  const names = [0, 1, 2, 3, 4, 5].map(scene.guardianFrameName);
  assert.deepEqual(names, ['frame_000', 'frame_001', 'frame_002', 'frame_004', 'frame_005', 'frame_003']);
  for (const name of names) {
    const frame = atlas.frames[name];
    const placement = scene.atlasFramePlacement(frame, 550, 357, 155);
    assert.ok(frame.frame.x >= 0 && frame.frame.y >= 0);
    assert.ok(frame.frame.x + frame.frame.w <= atlas.meta.size.w);
    assert.ok(frame.frame.y + frame.frame.h <= atlas.meta.size.h);
    assert.ok(placement.dw > 0 && placement.dh > 0);
    assert.equal(placement.dy + placement.dh, 357);
  }
  const throwFrame = atlas.frames.frame_005;
  const bodyOnly = scene.atlasFramePlacement(throwFrame, 550, 357, 155, 448);
  assert.equal(bodyOnly.sw, 448, 'throw pose omits its baked-in flying disc');
  assert.ok(bodyOnly.sx + bodyOnly.sw < throwFrame.frame.x + throwFrame.frame.w);
  assert.ok(bodyOnly.dw < scene.atlasFramePlacement(throwFrame, 550, 357, 155).dw);
});

test('guardian advances through transition frames instead of freezing for each event', () => {
  const pose = (type, fraction) => scene.guardianPoseForEvent({ type }, fraction);
  assert.deepEqual([0, .26, .51, .76].map(f => pose('place', f)), [0, 1, 2, 3]);
  assert.deepEqual([0, .26, 1].map(f => pose('throw', f)), [3, 4, 4]);
  assert.equal(pose('armor-hit', .5), 4);
  assert.equal(pose('armor-break', .5), 4);
  assert.deepEqual([0, .52, .9].map(f => pose('return', f)), [4, 5, 0]);
  assert.equal(scene.guardianPoseForEvent(null, 0), 0);
});

test('replay projection preserves civilian and captured enemy identities', () => {
  const round = simulateRescue(0, 0);
  const start = projectReplay(round.events, -1);
  assert.equal(start.civilians.size, 0);
  const end = projectReplay(round.events, round.events.length - 1);
  assert.equal(end.civilians.size, 5);
  assert.equal([...end.civilians.values()].filter(c => c.status === 'boarded').length, round.boarded);
  for (const event of round.events.filter(e => e.type === 'capture')) {
    assert.equal(end.enemies.get(event.sourceId).status, 'captured');
    assert.equal(end.shields.get(`shield-${event.sourceId}`).capturedId, event.sourceId);
  }
});

test('starter shield is attached in idle, not duplicated beside the guardian', () => {
  assert.equal(typeof scene.starterShieldVisual, 'function');
  const shield = projectReplay([], -1).shields.get('starter-shield');
  assert.equal(scene.starterShieldVisual(shield, null, 0), null);
});

test('starter shield has no duplicate placed image and flies from guardian to target', () => {
  assert.equal(typeof scene.starterShieldVisual, 'function');
  const shield = { id: 'starter-shield', lane: 1, status: 'placed' };
  const placed = scene.starterShieldVisual(shield, null, 0);
  const throwEvent = { type: 'throw', sourceId: shield.id, lane: 0 };
  const returnEvent = { type: 'return', sourceId: shield.id, lane: 0 };
  const preLaunch = scene.starterShieldVisual(shield, throwEvent, .2);
  const start = scene.starterShieldVisual(shield, throwEvent, .25);
  const end = scene.starterShieldVisual(shield, throwEvent, 1);
  assert.equal(placed, null);
  assert.equal(preLaunch, null, 'held shield is not duplicated before release');
  assert.ok(scene.starterShieldVisual(shield, returnEvent, .25), 'disc reels back before the return pose');
  assert.equal(scene.starterShieldVisual(shield, returnEvent, .5), null,
    'return pose takes over when the disc reaches the guardian');
  assert.equal(start.width / start.height, start.sw / start.sh);
  assert.ok(start.sx >= 1040 && start.sx + start.sw <= 1184, 'disc crop stays inside frame_005');
  assert.ok(start.sy >= 520 && start.sy + start.sh <= 620, 'disc crop avoids the actor pose');
  assert.ok(start.x > 500 && end.x < 300, 'disc travels from guardian toward enemy lane');
  assert.ok(end.y < start.y - 50);
});

test('civilians and captured foes stay readable at gameplay scale', () => {
  assert.equal(typeof scene.civilianVisualHeight, 'function');
  assert.equal(typeof scene.capturedReturnVisual, 'function');
  assert.ok(scene.civilianVisualHeight() >= 115);
  const start = scene.capturedReturnVisual(1, 0, 'heavy');
  const end = scene.capturedReturnVisual(1, 1, 'heavy');
  assert.ok(start.height > end.height, 'same captured enemy shrinks into shield form');
  assert.ok(Math.abs(end.x - start.x) >= 70, 'captured enemy visibly travels toward guardian');
});

test('enemies in one wave advance together from different entry offsets', () => {
  assert.equal(typeof scene.replaySegments, 'function');
  assert.equal(typeof scene.enemyTravelPoint, 'function');
  const events = simulateRescue(0, 2).events;
  const segment = scene.replaySegments(events).find(group => group.length > 1 && group[0].type === 'approach');
  assert.equal(segment.length, 4);
  const starts = segment.map(event => scene.enemyTravelPoint(event, 0));
  const ends = segment.map(event => scene.enemyTravelPoint(event, 1));
  assert.ok(new Set(starts.map(point => `${point.x},${point.y}`)).size > 1);
  assert.ok(starts.every((point, index) => point.y < ends[index].y - 30));
  assert.ok(starts.every(point => point.y >= 210), 'enemy feet start on the far courtyard floor');
  assert.ok(ends.every(point => point.y >= 265 && point.y <= 290), 'feet stop on the floor, away from guardian');
});

test('shield hits the targeted enemy body, not the abstract lane center', () => {
  const events = simulateRescue(0, 0).events;
  const thrown = events.find(event => event.type === 'throw');
  const state = projectReplay(events, thrown.ordinal - 1);
  const target = state.enemies.get(thrown.targetId);
  const impact = scene.enemyImpactPoint(target);
  const visual = scene.starterShieldVisual(state.shields.get(thrown.sourceId), thrown, 1, target);
  assert.equal(visual.x, impact.x);
  assert.equal(visual.y, impact.y);
  assert.notEqual(impact.x, 550, 'enemy serial offset is respected');
  const hit = events.find(event => event.type === 'armor-hit' && event.sourceId === target.id);
  const hitState = projectReplay(events, hit.ordinal - 1);
  const visibleHit = scene.starterShieldVisual(hitState.shields.get(thrown.sourceId), hit, .5, target);
  assert.equal(visibleHit.x, impact.x, 'disc remains in contact during the hit');
});

test('captured enemy falls where it stood before the same body returns as shield', () => {
  const events = simulateRescue(0, 0).events;
  const capture = events.find(event => event.type === 'capture');
  const target = projectReplay(events, capture.ordinal - 1).enemies.get(capture.sourceId);
  const point = scene.enemyTravelPoint(target, 1);
  const fallen = scene.capturedReturnVisual(target.lane, 0, target.kind, Number(target.id.split('-')[1]));
  assert.equal(fallen.x, point.x);
  assert.equal(fallen.y, point.y);
  assert.equal(scene.enemyFrameName('downed'), 'downed');
});

test('civilians share one starting point and finish at the vehicle door', () => {
  const starts = [0, 1, 2].map(lane => scene.civilianRoute({ lane, progress: 0 }, 0));
  assert.deepEqual(starts[0], starts[1]);
  assert.deepEqual(starts[1], starts[2]);
  const door = scene.civilianRoute({ lane: 0, progress: .8 }, 1);
  assert.ok(door.x > 850 && door.x < 1050);
  assert.ok(door.y > 350 && door.y < 420);
  assert.ok(scene.rescueVehicleX(-1, 0) > 1100, 'vehicle enters from the right');
  assert.ok(scene.rescueVehicleX(1, 0) < 1100, 'vehicle parks in the arena');
});

test('arena prose is screen-reader only and generated vehicle/downed sprites are RGBA PNGs', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /class="arena-top visually-hidden"/);
  assert.match(html, /id="status" class="visually-hidden"/);
  assert.doesNotMatch(html, /class="lane-names"/);
  for (const file of ['auto-rescue-van-v1.png', 'auto-rescue-heavy-downed-v1.png',
    'auto-rescue-rogue-downed-v1.png', 'auto-rescue-beast-downed-v1.png']) {
    const data = readFileSync(new URL(`../public/assets/${file}`, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), 'PNG', file);
    assert.equal(data[25], 6, `${file} has an RGBA channel`);
  }
});

test('combat cues are derived only from the active replay event', () => {
  const round = simulateRescue(0, 0);
  const shot = round.events.find(event => event.type === 'shot' && event.targetId?.startsWith('civilian-'));
  const hit = round.events.find(event => event.type === 'armor-hit');
  const broken = round.events.find(event => event.type === 'armor-break');
  const capture = round.events.find(event => event.type === 'capture');
  assert.equal(eventCue(shot).kind, 'shot');
  assert.equal(eventCue(hit).kind, 'armor-hit');
  assert.equal(eventCue(broken).kind, 'armor-break');
  assert.equal(eventCue(capture).kind, 'capture');
  assert.equal(eventCue(round.events.find(event => event.type === 'spawn')), null);
});

test('civilian path progress never jumps backward and replay projection is repeatable', () => {
  const events = simulateRescue(1, 728).events;
  const progress = new Map();
  for (let index = 0; index < events.length; index++) {
    const state = projectReplay(events, index);
    assert.deepEqual(state, projectReplay(events, index));
    for (const civilian of state.civilians.values()) {
      if (civilian.status === 'boarded' || civilian.status === 'lost') continue;
      assert.ok(civilian.progress >= (progress.get(civilian.id) ?? 0), `backward path for ${civilian.id}`);
      progress.set(civilian.id, civilian.progress);
    }
  }
});

test('every contract outcome projects the same final civilians and shields as its event trace', () => {
  for (const formation of [0, 1]) for (let outcome = 0; outcome < 729; outcome++) {
    const round = simulateRescue(formation, outcome);
    const view = projectReplay(round.events, round.events.length - 1);
    for (const civilian of round.civilians)
      assert.equal(view.civilians.get(civilian.id)?.status, civilian.status, `${formation}/${outcome}/${civilian.id}`);
    for (const shield of round.shields) {
      const shown = view.shields.get(shield.id);
      assert.equal(shown?.capturedId, shield.capturedId, `${formation}/${outcome}/${shield.id} identity`);
      assert.equal(shown?.integrity, shield.integrity, `${formation}/${outcome}/${shield.id} integrity`);
      assert.equal(shown?.status, shield.status, `${formation}/${outcome}/${shield.id} status`);
    }
  }
});
