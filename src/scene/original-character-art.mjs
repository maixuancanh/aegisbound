import { createMsuScene } from '../../legacy-kinesis/src/msu-scene.js';
import { createRescueScene } from '../../legacy-kinesis/src/rescue-scene.js';
import { projectBody, projectGround } from '../../legacy-kinesis/src/projection.js';

const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;
const coverArt = {crate:'artgen/kinesis-cover-character-v1.png',stone:'artgen/kinesis-cover-enemy-v1.png',sign:'artgen/kinesis-cover-civilian-v1.png'};
const loadImage = name => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(Error(`Missing character art: ${name}`));
  image.src = asset(name);
});

export async function loadOriginalCharacterArt(progress = () => {}) {
  const [enemyAtlas, civilianAtlas] = await Promise.all([
    fetch(asset('auto-rescue-enemy-atlas-v2.json')).then(response => response.json()),
    fetch(asset('auto-rescue-civilian-atlas-v2.json')).then(response => response.json()),
  ]);
  const names = ['hero-idle-empty-v1.png', 'hero-throw-empty-v1.png',
    'auto-rescue-van-v1.png', ...Object.values(coverArt),
    ...Object.values(enemyAtlas.enemies).map(entry => entry.image),
    ...civilianAtlas.civilians.map(entry => entry.image)];
  const uniqueNames = [...new Set(names)];
  let done = 0;
  progress(done, uniqueNames.length);
  const images = new Map(await Promise.all(uniqueNames.map(async name => {
    const image = await loadImage(name);
    progress(++done, uniqueNames.length);
    return [name, image];
  })));
  return { images, enemyAtlas, civilianAtlas };
}

function drawGrounded(ctx, image, frame, entity, height, { opacity = 1, flip = false } = {}) {
  const point = projectGround(entity);
  const source = frame ?? { x: 0, y: 0, w: image.width, h: image.height };
  const targetHeight = height * point.scale;
  const targetWidth = targetHeight * source.w / source.h;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.translate(point.x, point.y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, source.x, source.y, source.w, source.h,
    -targetWidth / 2, -targetHeight, targetWidth, targetHeight);
  ctx.restore();
}

// These atlases have two authored poses, not a fixed-cell sprite grid. Keep
// every crop in its JSON bounds and change poses only during visible motion.
export function spritePresentation(entity, tick, kind) {
  const idOffset = Number(String(entity.id ?? '').match(/\d+$/)?.[0] ?? 0) * 3;
  const alternate = Math.floor((tick + idOffset) / 12) % 2 === 1;
  if (kind === 'civilian') {
    const moving = ['moving', 'to-vehicle'].includes(entity.status);
    return { frame: moving && alternate ? 'run' : 'walk', flip: entity.facing === 'left' };
  }
  const moving = Math.hypot(entity.vx ?? 0, entity.vy ?? 0) > .1 || entity.archetype === 'Looper';
  return { frame: entity.telegraph || moving && alternate ? 'attack' : 'advance', flip: entity.x < 480 };
}

const enemyType = entity => {
  const key = entity.capturedVisualKey ?? '';
  if (['commander', 'breaker', 'raider'].includes(entity.role) || /clang|boar|golem/.test(key)) return 'heavy';
  if (['bait', 'engineer'].includes(entity.role) || /boogie|bubbling/.test(key)) return 'rogue';
  return 'beast';
};

export function useOriginalCharacterArt(assets, art) {
  assets.characterSceneFactory = (ctx, sourceAssets, animator) => {
    const original = createMsuScene(ctx, sourceAssets, animator);
    return {
      backdrop: original.backdrop,
      scenery: original.scenery,
      body(entity, state, settings) {
        if (entity.id === 'player') {
          const pose = animator.pose(state);
          const name = pose.action === 'throw' ? 'hero-throw-empty-v1.png' : 'hero-idle-empty-v1.png';
          drawGrounded(ctx, art.images.get(name), null, entity, 88,
            { flip: pose.facing === 1 });
          return;
        }
        if (entity.enemy || entity.capturedId) {
          const entry = art.enemyAtlas.enemies[enemyType(entity)];
          const presentation = spritePresentation(entity, state.tick, 'enemy');
          const frame = entry.frames[presentation.frame];
          drawGrounded(ctx, art.images.get(entry.image), frame, entity,
            enemyType(entity) === 'heavy' ? 90 : 74,
            { opacity: entity.status === 'returning' ? .65 : 1, flip: presentation.flip });
          return;
        }
        const coverImage = art.images.get(coverArt[entity.appearance ?? entity.kind]);
        if (coverImage && entity.status && !entity.enemy) {
          const p=projectBody(entity), size=66*p.scale;
          const scale=size/Math.max(coverImage.width,coverImage.height);
          ctx.save();
          ctx.imageSmoothingEnabled=true;
          ctx.globalAlpha*=entity.status==='returning'?.65:1;
          ctx.drawImage(coverImage,p.x-coverImage.width*scale/2,p.y-coverImage.height*scale/2,coverImage.width*scale,coverImage.height*scale);
          ctx.restore();
          return;
        }
        original.body(entity, state, settings);
      },
    };
  };
  assets.rescueSceneFactory = (ctx, sourceAssets) => {
    const original = createRescueScene(ctx, sourceAssets);
    return {
      entities: original.entities,
      body(entity, state, settings) {
        if (entity.civilian) {
          const entry = art.civilianAtlas.civilians[entity.variant % art.civilianAtlas.civilians.length];
          const presentation = spritePresentation(entity, state.tick, 'civilian');
          const fade = entity.status === 'lost' ? Math.max(0, 1 - (state.tick - (entity.lostAt ?? state.tick)) / 36) : 1;
          drawGrounded(ctx, art.images.get(entry.image), entry.frames[presentation.frame], entity, 56,
            { opacity: fade, flip: presentation.flip });
          return;
        }
        if (entity.rescueVehicle) {
          drawGrounded(ctx, art.images.get('auto-rescue-van-v1.png'),
            { x: 40, y: 108, w: 1480, h: 788 }, entity, 122,
            { flip: entity.facing === 'right' });
          return;
        }
        original.body(entity, state, settings);
      },
    };
  };
  return assets;
}
