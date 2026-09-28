const laneX = lane => 185 + lane * 365;
const SCENE_WIDTH = 1100;
const SCENE_HEIGHT = 420;
export function canvasBackingSize(cssWidth, dpr = 1) {
  const width = Math.max(1, Math.round(cssWidth * Math.min(2, Math.max(1, dpr))));
  return { width, height: Math.max(1, Math.round(width * SCENE_HEIGHT / SCENE_WIDTH)) };
}
const durationFor = type => ({ approach: 1120, throw: 480, return: 520, board: 900,
  'civilian-enter': 250, shot: 270, 'armor-hit': 240,
  'armor-break': 320, 'shield-break': 360, block: 230, retreat: 330,
  'civilian-lost': 330, capture: 420, place: 400 }[type] ?? 130);

export function replaySegments(events) {
  const segments = [];
  for (let index = 0; index < events.length;) {
    const first = events[index];
    let end = index + 1;
    if (first.type === 'approach')
      while (end < events.length && events[end].type === 'approach' && events[end].wave === first.wave) end++;
    segments.push(events.slice(index, end));
    index = end;
  }
  return segments;
}

export function enemyTravelPoint(event, fraction) {
  const serial = Number((event.sourceId ?? event.id).split('-')[1]) || 1;
  const entryX = laneX(event.lane) + (serial % 3 - 1) * 55;
  const targetX = laneX(event.lane) + (serial % 3 - 1) * 25 +
    (event.lane === 1 ? 100 : event.lane === 2 ? -50 : 0);
  const entryY = 220 + serial % 3 * 8;
  const targetY = 274 + serial % 3 * 4;
  return { x: entryX + (targetX - entryX) * fraction,
    y: entryY + (targetY - entryY) * fraction };
}

export const civilianVisualHeight = () => 132;
export const civilianFrameName = phase => phase % 2 ? 'run' : 'walk';
export const enemyAssetKey = (kind, id) => kind === 'heavy' ? 'heavy' : Number(id?.split('-')[1]) % 2 ? 'rogue' : 'beast';
export const enemyFrameName = status => status === 'downed' ? 'downed' : status === 'attacking' ? 'attack' : 'advance';

export function enemyImpactPoint(enemy) {
  const foot = enemyTravelPoint(enemy, 1);
  return { x: foot.x, y: foot.y - (enemy.kind === 'heavy' ? 76 : 54) };
}

const CIVILIAN_START = { x: 112, y: 384 };
const VEHICLE_DOOR = { x: 975, y: 385 };
export function civilianRoute(civilian, boardingFraction = 0) {
  const progress = Math.max(0, Math.min(.9, civilian.progress ?? 0));
  const travel = progress + (1 - progress) * Math.max(0, Math.min(1, boardingFraction));
  return { x: CIVILIAN_START.x + (VEHICLE_DOOR.x - CIVILIAN_START.x) * travel,
    y: CIVILIAN_START.y + (VEHICLE_DOOR.y - CIVILIAN_START.y) * travel -
      18 * Math.max(0, Math.min(1, (boardingFraction - .72) / .28)) };
}

export function rescueVehicleX(cursor, fraction) {
  return 1225 + (950 - 1225) * Math.max(0, Math.min(1, (cursor + 1 + fraction) / 2));
}

const guardianFrames = ['frame_000', 'frame_001', 'frame_002', 'frame_004', 'frame_005', 'frame_003'];
export const guardianFrameName = pose => guardianFrames[pose] ?? guardianFrames[0];

// The GIF's six distinct poses are action keyframes, not a loop. Sample them
// against the replay event so a redraw does not jump to idle between hits.
export function guardianPoseForEvent(event, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  switch (event?.type) {
    case 'place': return t < .25 ? 0 : t < .5 ? 1 : t < .75 ? 2 : 3;
    case 'throw': return t < .25 ? 3 : 4;
    case 'armor-hit':
    case 'armor-break':
    case 'capture': return 4;
    case 'return': return t < .5 ? 4 : t < .83 ? 5 : 0;
    default: return 0;
  }
}

export function atlasFramePlacement(entry, x, footY, height, visibleWidth = entry?.frame.w) {
  if (!entry || entry.rotated) throw new Error('Guardian atlas frame is missing or rotated');
  const source = entry.sourceSize;
  const offset = entry.spriteSourceSize;
  const scale = height / source.h;
  return {
    sx: entry.frame.x, sy: entry.frame.y, sw: visibleWidth, sh: entry.frame.h,
    dx: x - source.w * scale / 2 + offset.x * scale,
    dy: footY - height + offset.y * scale,
    dw: visibleWidth * scale, dh: entry.frame.h * scale,
  };
}

// The isolated airborne disc in the guardian's throw pose. Never draw another
// disc while placed/orbiting: those poses already contain the held shield.
export function starterShieldVisual(shield, event, fraction, enemy) {
  if (!shield || shield.status === 'orbit' || shield.status === 'destroyed') return null;
  const thrown = event?.type === 'throw' && event.sourceId === shield.id;
  const returning = event?.type === 'return' && event.sourceId === shield.id;
  const touching = ['armor-hit', 'armor-break', 'capture'].includes(event?.type) && event.targetId === shield.id;
  if (!touching && (!thrown || fraction < .25) && (!returning || fraction >= .5)) return null;
  const sx = 1043, sy = 525, sw = 140, sh = 90;
  const width = 108, height = width * sh / sw;
  const travel = touching ? 1 : returning ? 1 - fraction * 2 : (fraction - .25) / .75;
  const target = enemy ? enemyImpactPoint(enemy) : { x: laneX(event.lane), y: 205 };
  const targetX = target.x;
  const x = 610 + (targetX - 610) * travel;
  const y = 260 + (target.y - 260) * travel - 28 * Math.sin(Math.PI * travel);
  return { sx, sy, sw, sh, x, y, width, height };
}

export function capturedReturnVisual(lane, fraction, kind, serial = 1) {
  const orbitX = serial % 2 ? 395 : 705;
  const start = enemyTravelPoint({ lane, kind, id: `enemy-${serial}` }, 1);
  const startHeight = kind === 'heavy' ? 150 : 112;
  const endHeight = kind === 'heavy' ? 100 : 88;
  return {
    x: start.x + (orbitX - start.x) * fraction,
    y: start.y + (302 - start.y) * fraction - 28 * Math.sin(Math.PI * fraction),
    height: startHeight + (endHeight - startHeight) * fraction,
  };
}

export function eventCue(event, state) {
  if (!event || !['shot', 'armor-hit', 'armor-break', 'capture', 'block', 'shield-break'].includes(event.type)) return null;
  const targetEnemy = state?.enemies.get(event.sourceId);
  const impact = targetEnemy ? enemyImpactPoint(targetEnemy) : { x: laneX(event.lane), y: 210 };
  const x = impact.x;
  if (event.type === 'shot') {
    const civilian = state?.civilians.get(event.targetId);
    const destination = civilian ? civilianRoute(civilian) : { x, y: 270 };
    return { kind: 'shot', x, y: impact.y, toX: destination.x,
      toY: destination.y - 66, color: '#ffbd77' };
  }
  if (event.type === 'capture') return { kind: 'capture', x, y: impact.y, toX: x, toY: impact.y, color: '#55dcf9' };
  if (event.type === 'block' || event.type === 'shield-break')
    return { kind: event.type, x, y: 270, color: event.type === 'block' ? '#67d8fa' : '#ffd18c' };
  return { kind: event.type, x, y: impact.y, color: '#79e7ff' };
}

export function projectReplay(events, index) {
  const civilians = new Map(), enemies = new Map(), shields = new Map([
    ['starter-shield', { id: 'starter-shield', capturedId: null, lane: 1, integrity: 3, status: 'orbit' }],
  ]);
  let lastEvent = null;
  for (let i = 0; i <= Math.min(index, events.length - 1); i++) {
    const event = events[i]; lastEvent = event;
    switch (event.type) {
      case 'civilian-enter': civilians.set(event.sourceId, { id: event.sourceId, lane: event.lane, status: 'walking', progress: 0 }); break;
      case 'civilian-hit': civilians.get(event.sourceId).status = 'hurt'; break;
      case 'civilian-lost': civilians.get(event.sourceId).status = 'lost'; break;
      case 'board': civilians.get(event.sourceId).status = 'boarded'; break;
      case 'spawn': enemies.set(event.sourceId, { id: event.sourceId, lane: event.lane, kind: event.state, status: 'spawned', armor: 0 }); break;
      case 'approach': enemies.get(event.sourceId).status = 'approaching'; break;
      case 'shot': enemies.get(event.sourceId).status = 'attacking'; break;
      case 'armor-hit': enemies.get(event.sourceId).armor++; enemies.get(event.sourceId).status = 'hit'; break;
      case 'armor-break': enemies.get(event.sourceId).status = 'armor-broken'; break;
      case 'capture': {
        const enemy = enemies.get(event.sourceId); enemy.status = 'captured';
        if (shields.has(event.targetId)) shields.get(event.targetId).status = 'placed';
        shields.set(`shield-${enemy.id}`, { id: `shield-${enemy.id}`, capturedId: enemy.id,
          lane: enemy.lane, integrity: enemy.kind === 'heavy' ? 3 : 2, status: 'returning' });
        break;
      }
      case 'retreat': enemies.get(event.sourceId).status = 'retreated'; break;
      case 'place': if (shields.has(event.sourceId)) Object.assign(shields.get(event.sourceId), { lane: event.lane, status: 'placed' }); break;
      case 'throw': if (shields.has(event.sourceId)) Object.assign(shields.get(event.sourceId), { status: 'flight', lastTargetId: event.targetId }); break;
      case 'block': if (shields.has(event.sourceId)) shields.get(event.sourceId).integrity = Number(event.state); break;
      case 'shield-break': if (shields.has(event.sourceId)) shields.get(event.sourceId).status = 'destroyed'; break;
      case 'return': {
        const id = enemies.get(event.sourceId)?.status === 'captured' ? `shield-${event.sourceId}` : event.sourceId;
        if (shields.has(id)) shields.get(id).status = 'orbit';
        break;
      }
    }
    for (const civilian of civilians.values()) {
      if (civilian.status === 'walking' || civilian.status === 'hurt')
        civilian.progress = Math.min(.9, civilian.progress + .035);
    }
  }
  return { civilians, enemies, shields, lastEvent };
}

export function createAutoRescueScene(canvas, baseUrl) {
  const ctx = canvas.getContext('2d');
  const syncCanvasResolution = () => {
    const size = canvasBackingSize(canvas.getBoundingClientRect().width || SCENE_WIDTH, window.devicePixelRatio);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    ctx.setTransform(canvas.width / SCENE_WIDTH, 0, 0, canvas.height / SCENE_HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };
  const images = {};
  for (const [key, file] of Object.entries({
    guardian: 'auto-rescue-guardian-atlas-v2.png',
    van: 'auto-rescue-van-v1.png',
    heavyDowned: 'auto-rescue-heavy-downed-v1.png',
    rogueDowned: 'auto-rescue-rogue-downed-v1.png',
    beastDowned: 'auto-rescue-beast-downed-v1.png',
  })) {
    const image = new Image(); image.onload = () => draw(); image.src = `${baseUrl}assets/${file}`; images[key] = image;
  }
  let guardianAtlas = null;
  let civilianAtlas = null;
  let enemyAtlas = null;
  fetch(`${baseUrl}assets/auto-rescue-enemy-atlas-v2.json`)
    .then(response => { if (!response.ok) throw new Error(`Enemy atlas HTTP ${response.status}`); return response.json(); })
    .then(atlas => {
      enemyAtlas = atlas;
      for (const [key, enemy] of Object.entries(atlas.enemies)) {
        const image = new Image();
        image.onload = () => draw();
        image.src = `${baseUrl}assets/${enemy.image}`;
        images[key] = image;
      }
      draw();
    })
    .catch(error => console.error('Enemy atlas could not load:', error));
  fetch(`${baseUrl}assets/auto-rescue-civilian-atlas-v2.json`)
    .then(response => { if (!response.ok) throw new Error(`Civilian atlas HTTP ${response.status}`); return response.json(); })
    .then(atlas => {
      civilianAtlas = atlas;
      atlas.civilians.forEach((civilian, index) => {
        const image = new Image();
        image.onload = () => draw();
        image.src = `${baseUrl}assets/${civilian.image}`;
        images[`civilian${index}`] = image;
      });
      draw();
    })
    .catch(error => console.error('Civilian atlas could not load:', error));
  fetch(`${baseUrl}assets/auto-rescue-guardian-atlas-v2.json`)
    .then(response => { if (!response.ok) throw new Error(`Guardian atlas HTTP ${response.status}`); return response.json(); })
    .then(atlas => { guardianAtlas = atlas; draw(); })
    .catch(error => console.error('Guardian atlas could not load:', error));
  let events = [], cursor = -1, fraction = 0, activeEvents = [];
  const drawEnemy = (kind, id, status, x, footY, height, opacity = 1) => {
    const key = enemyAssetKey(kind, id);
    const downed = status === 'downed';
    const image = images[downed ? `${key}Downed` : key];
    const downedCrop = { heavy: { x: 36, y: 172, w: 1468, h: 676 },
      rogue: { x: 188, y: 268, w: 1464, h: 496 },
      beast: { x: 128, y: 144, w: 1540, h: 648 } };
    const frame = downed ? downedCrop[key] : enemyAtlas?.enemies[key]?.frames[enemyFrameName(status)];
    if (!frame || !image?.complete || !image.naturalWidth) return;
    const w = height * frame.w / frame.h;
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.shadowColor = '#06121dcc'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h,
      x - w / 2, footY - height, w, height);
    ctx.restore();
  };
  const drawGuardian = (pose, x, footY, height) => {
    const image = images.guardian;
    if (!guardianAtlas || !image.complete || !image.naturalWidth) return;
    const entry = guardianAtlas.frames[guardianFrameName(pose)];
    const p = atlasFramePlacement(entry, x, footY, height, pose === 4 ? 448 : entry.frame.w);
    ctx.save();
    ctx.shadowColor = '#06121dcc'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.drawImage(image, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
    ctx.restore();
  };
  const drawCivilian = (id, pose, x, footY, height, opacity) => {
    const image = images[`civilian${id}`];
    const frame = civilianAtlas?.civilians[id]?.frames[civilianFrameName(pose)];
    if (!frame || !image?.complete || !image.naturalWidth) return;
    const width = height * frame.w / frame.h;
    ctx.save(); ctx.globalAlpha = opacity;
    ctx.shadowColor = '#06121dcc'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h,
      x - width / 2, footY - height, width, height);
    ctx.restore();
  };
  const drawCue = cue => {
    if (!cue) return;
    ctx.save();
    const alpha = Math.sin(Math.PI * fraction);
    ctx.globalAlpha = Math.max(.15, alpha);
    ctx.strokeStyle = cue.color;
    ctx.fillStyle = cue.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = cue.color;
    ctx.shadowBlur = 16;
    if (cue.toX !== undefined) {
      const tipX = cue.x + (cue.toX - cue.x) * fraction;
      const tipY = cue.y + (cue.toY - cue.y) * fraction;
      ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.beginPath(); ctx.arc(tipX, tipY, 5 + (cue.kind === 'capture' ? 5 : 0), 0, Math.PI * 2); ctx.fill();
    } else {
      const radius = cue.kind === 'shield-break' ? 18 + 55 * fraction : 13 + 32 * fraction;
      ctx.beginPath(); ctx.arc(cue.x, cue.y, radius, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3 + .4;
        const sx = cue.x + Math.cos(angle) * radius;
        const sy = cue.y + Math.sin(angle) * radius;
        ctx.beginPath(); ctx.arc(sx, sy, cue.kind === 'shield-break' ? 4 : 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  };
  function draw() {
    syncCanvasResolution();
    ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    const state = projectReplay(events, cursor);
    const current = events[cursor + 1];
    for (let lane = 0; lane < 3; lane++) {
      ctx.save(); ctx.strokeStyle = '#85d6e355'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(laneX(lane), 338, 84, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const van = images.van;
    if (van?.complete && van.naturalWidth) {
      const width = 245, height = width * 788 / 1480;
      ctx.save();
      ctx.shadowColor = '#07111bd8'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
      ctx.drawImage(van, 40, 108, 1480, 788,
        rescueVehicleX(cursor, fraction) - width / 2, 411 - height, width, height);
      ctx.restore();
    }
    for (const civilian of state.civilians.values()) {
      if (civilian.status === 'lost' || civilian.status === 'boarded') continue;
      const id = Number(civilian.id.split('-')[1]) - 1;
      const travel = Math.min(.9, civilian.progress + .035 * fraction);
      const boarding = current?.type === 'board' && current.sourceId === civilian.id;
      const falling = current?.type === 'civilian-lost' && current.sourceId === civilian.id;
      const route = civilianRoute({ ...civilian, progress: travel }, boarding ? fraction : 0);
      drawCivilian(id, civilian.status === 'hurt' ? 0 : Math.floor(cursor / 2) % 2,
        route.x, route.y + (falling ? 26 * fraction : 0), civilianVisualHeight(),
        boarding ? Math.max(0, Math.min(1, (1 - fraction) / .2)) : falling ? 1 - fraction : 1);
    }
    for (const shield of state.shields.values()) {
      if (shield.status === 'destroyed') continue;
      if (shield.capturedId) {
        const source = state.enemies.get(shield.capturedId);
        const serial = Number(source?.id.split('-')[1]) || 1;
        const orbit = capturedReturnVisual(shield.lane, 1, source?.kind, serial);
        const impactEnemy = state.enemies.get(current?.targetId ?? shield.lastTargetId);
        const impact = impactEnemy ? enemyImpactPoint(impactEnemy) : { x: laneX(shield.lane), y: 205 };
        const thrown = current?.type === 'throw' && current.sourceId === shield.id;
        const returningCaptured = current?.type === 'return' && current.sourceId === shield.capturedId;
        const returningThrown = current?.type === 'return' && current.sourceId === shield.id;
        const touching = ['armor-hit', 'armor-break', 'capture'].includes(current?.type) && current.targetId === shield.id;
        let x = shield.status === 'placed' ? laneX(shield.lane) : orbit.x;
        let y = shield.status === 'placed' ? 335 : orbit.y;
        let height = orbit.height;
        if (thrown) { x += (impact.x - x) * fraction; y += (impact.y - y) * fraction - 28 * Math.sin(Math.PI * fraction); }
        if (touching) { x = impact.x; y = impact.y; }
        if (returningThrown) {
          x = impact.x + (orbit.x - impact.x) * fraction;
          y = impact.y + (orbit.y - impact.y) * fraction - 28 * Math.sin(Math.PI * fraction);
        }
        if (returningCaptured) {
          const path = capturedReturnVisual(shield.lane, fraction, source?.kind, serial);
          x = path.x; y = path.y; height = path.height;
        }
        drawEnemy(source?.kind, source?.id, returningCaptured && fraction < .28 ? 'downed' : 'captured',
          x, y, returningCaptured && fraction < .28 ? source?.kind === 'heavy' ? 70 : 52 : height, .9);
      }
    }
    for (const enemy of state.enemies.values()) {
      if (enemy.status === 'retreated' || enemy.status === 'captured') continue;
      const heavy = enemy.kind === 'heavy';
      const moving = activeEvents.find(event => event.type === 'approach' && event.sourceId === enemy.id);
      const point = enemyTravelPoint(enemy, moving ? fraction : enemy.status === 'spawned' ? 0 : 1);
      let y = point.y;
      const retreating = current?.type === 'retreat' && current.sourceId === enemy.id;
      if (retreating) y -= 90 * fraction;
      const downed = current?.type === 'capture' && current.sourceId === enemy.id && fraction >= .18;
      drawEnemy(enemy.kind, enemy.id, downed ? 'downed' : enemy.status, point.x, y,
        downed ? heavy ? 70 : 52 : heavy ? 150 : 112,
        retreating ? 1 - fraction : 1);
    }
    // Keep the thrown disc above the target sprite, so the contact is visible.
    for (const shield of state.shields.values()) {
      if (shield.capturedId) continue;
      const image = images.guardian;
      const target = state.enemies.get(current?.type === 'throw' ? current.targetId : shield.lastTargetId);
      const visual = starterShieldVisual(shield, current, fraction, target);
      if (visual && image?.complete && image.naturalWidth) {
        ctx.save(); ctx.globalAlpha = .92;
        ctx.drawImage(image, visual.sx, visual.sy, visual.sw, visual.sh,
          visual.x - visual.width / 2, visual.y - visual.height / 2, visual.width, visual.height);
        ctx.restore();
      }
    }
    const guardianPose = guardianPoseForEvent(current, fraction);
    drawGuardian(guardianPose, 550, 357, 155);
    drawCue(eventCue(current, state));
  }
  window.addEventListener('resize', draw);
  return {
    setEvents(next) { events = next; cursor = -1; fraction = 0; activeEvents = []; draw(); },
    draw,
    async replay(next, onEvent = () => {}, reduced = false) {
      this.setEvents(next);
      for (const group of replaySegments(next)) {
        activeEvents = group;
        const duration = reduced ? 12 : durationFor(group[0].type);
        const start = performance.now();
        await new Promise(resolve => {
          const frame = now => {
            fraction = Math.min(1, (now - start) / duration);
            draw();
            if (fraction >= 1) resolve(); else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        cursor = group.at(-1).ordinal; fraction = 0; activeEvents = [];
        for (const event of group) onEvent(event);
        draw();
      }
    },
  };
}
