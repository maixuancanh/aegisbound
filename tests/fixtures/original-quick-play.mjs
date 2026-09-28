import { createOriginalRunner } from '../../src/game/original-runner.mjs';
import { originalAutoCommands } from '../../src/game/original-auto-controller.mjs';
import { createRenderer } from '../../src/scene/original-renderer.js';
import { loadMsuAssets } from '../../legacy-kinesis/src/msu-assets.js';
import { loadOriginalCharacterArt, useOriginalCharacterArt } from '../../src/scene/original-character-art.mjs';

const canvas = document.querySelector('#world');
const assets = await loadMsuAssets();
useOriginalCharacterArt(assets, await loadOriginalCharacterArt());
const runner = createOriginalRunner(17);
const renderer = createRenderer(canvas, assets);
window.originalQuickPlayEventTypes = [];
let last = performance.now();
function frame(now) {
  const ticks = Math.min(6, Math.floor((now - last) / (1000 / 60)));
  for (let index = 0; index < ticks && runner.state.status === 'running'; index++) {
    const result = runner.advance(originalAutoCommands(runner.state));
    for (const event of result.events) window.originalQuickPlayEventTypes.push(event.type);
    renderer.events(result.events, result.state);
  }
  if (ticks) last = now;
  renderer.draw(runner.state);
  window.originalQuickPlayState = runner.state;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
