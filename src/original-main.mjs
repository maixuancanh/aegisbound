import { createOriginalScenario, originalScenarioCommands } from './game/original-scenario.mjs';
import { SHORT_ROUND_LIMIT } from './game/short-quick-play.mjs';
import { originalBoardedFor, originalPayoutFor, originalStatistics } from './game/original-outcome-table.mjs';
import { createRenderer } from './scene/original-renderer.js';
import { loadOriginalCharacterArt, useOriginalCharacterArt } from './scene/original-character-art.mjs';
import { idlePresentationTick } from './scene/original-presentation.mjs';
import { shouldWaitForVanExit, advanceVanExitPresentation } from './scene/departure-presentation.mjs';
import { loadMsuAssets } from '../legacy-kinesis/src/msu-assets.js';
import { createMsuAudio } from '../legacy-kinesis/src/msu-audio.js';
import { createRoundState, sampleOutcome } from './round-state.mjs';
import { parseAmount, formatAmount } from './amounts.mjs';

const $ = id => document.getElementById(id);
const embedded = window.parent !== window;
const demo = createRoundState(100000n);
const audio = createMsuAudio();
const audioSettings = { mute: false, music: .25, sfx: .6 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer, assets, bridge, busy = true, decimals = 2, activeRunner;
let idleState, idleStartedAt = 0, idleLastDraw = -Infinity, idleFrame = 0, idleEnabled = false;

function paintIdle(now) {
  if (!idleEnabled || activeRunner || document.hidden) return;
  if (now - idleLastDraw >= 50) {
    renderer.draw({ ...idleState, tick: idlePresentationTick(idleStartedAt, now) }, { reducedMotion });
    idleLastDraw = now;
  }
  idleFrame = requestAnimationFrame(paintIdle);
}
function startIdle() {
  if (!renderer || !idleState || activeRunner || idleEnabled || document.hidden) return;
  idleEnabled = true;
  idleStartedAt = performance.now();
  idleLastDraw = -Infinity;
  idleFrame = requestAnimationFrame(paintIdle);
}
function stopIdle() {
  idleEnabled = false;
  cancelAnimationFrame(idleFrame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopIdle();
  else if (!activeRunner && idleState && $('wave').textContent !== 'ROUND COMPLETE') startIdle();
});

function lock(value) {
  busy = value;
  $('play-again').disabled=value;
  if (!value && $('result-dialog').open) $('play-again').focus();
  for (const id of ['cast', 'formation', 'wager']) $(id).disabled = value;
  $('controls').setAttribute('aria-busy', String(value));
}
function visible(value) {
  const [whole, fraction = ''] = formatAmount(value, decimals).split('.');
  return BigInt(whole).toLocaleString('en-US') + (decimals ? '.' + fraction.padEnd(2, '0').slice(0, 2) : '');
}
function showBalance(value) {
  $('balance').textContent = visible(value);
  $('balance').title = `Exact balance: ${formatAmount(value, decimals)}`;
}
function showMath() {
  const formation = Number($('formation').value);
  const stats = originalStatistics(formation);
  $('math-summary').textContent = `Auto Quick Play uses the original rescue engine. ${stats.outcomeCount} equally likely outcomes; RTP ${(stats.rtp * 100).toFixed(2)}% at 100 USDC.`;
  $('paytable').textContent = stats.distribution.map(row =>
    `${row.boarded} rescued: ${(Number(row.payout) / 10000).toFixed(4)}× · ${row.count}/729 outcomes`).join('\n');
  if (!activeRunner && renderer) {
    idleState = createOriginalScenario(formation, 0).state;
    idleStartedAt = performance.now();
    idleLastDraw = -Infinity;
    renderer.draw(idleState, { reducedMotion });
  }
}
function reportEvent(event, state) {
  if (event.type === 'board' || event.type === 'civilian-lost') {
    $('rescued').textContent = `${state.rescue.boarded} / 5 RESCUED`;
  }
  if (['armor-break', 'capture', 'board', 'cover-broken', 'civilian-lost'].includes(event.type)) {
    const label = { 'armor-break': 'Armor broken', capture: 'Enemy captured',
      board: 'Civilian boarded', 'cover-broken': 'Shield destroyed',
      'civilian-lost': 'Civilian lost' }[event.type];
    $('status').textContent = label;
  }
}
async function playRound({ formation, outcomeIndex, payout, wager }) {
  if (payout !== originalPayoutFor(wager, formation, outcomeIndex)) throw Error('Payout does not match the original rescue outcome.');
  stopIdle();
  $('result-dialog').close();
  const runner = createOriginalScenario(formation, outcomeIndex);
  activeRunner = runner;
  $('formation').value = String(formation);
  $('rescued').textContent = '0 / 5 RESCUED';
  $('status').textContent = 'Evacuation in progress…';
  $('progress-label').textContent = 'EVACUATION IN PROGRESS';
  $('replay-progress').value = 0;
  lock(true);
  audio.start(audioSettings, false);
  // Present one original engine tick per rendered frame; the short scenario,
  // not a visual fast-forward, controls the round duration.
  await new Promise((resolve, reject) => {
    function frame() {
      try {
        const result = runner.advance(originalScenarioCommands(runner.state, formation));
        renderer.events(result.events, result.state);
        audio.play(result.events, audioSettings);
        for (const event of result.events) reportEvent(event, result.state);
        renderer.draw(runner.state, { reducedMotion });
        $('replay-progress').value = Math.min(.98, runner.state.tick / SHORT_ROUND_LIMIT);
        if (runner.state.status === 'running' && runner.state.tick < SHORT_ROUND_LIMIT) requestAnimationFrame(frame);
        else if (runner.state.status === 'running') reject(Error('Original rescue exceeded its deterministic limit.'));
        else resolve();
      } catch (error) { reject(error); }
    }
    requestAnimationFrame(frame);
  });
  if (runner.state.rescue.boarded !== originalBoardedFor(formation, outcomeIndex)) {
    throw Error('Original Quick Play result differs from settled contract.');
  }
  // Visual-only tail: never advance or mutate the authoritative settled run.
  let departure=runner.state.rescue.van;
  await new Promise(resolve=>{
    let previous=performance.now();
    function exitFrame(now) {
      if (!shouldWaitForVanExit(departure)) { resolve(); return; }
      departure=advanceVanExitPresentation(departure,(now-previous)/1000);
      previous=now;
      renderer.draw({...runner.state,rescue:{...runner.state.rescue,van:departure}},{reducedMotion});
      requestAnimationFrame(exitFrame);
    }
    requestAnimationFrame(exitFrame);
  });
  $('wave').textContent = 'ROUND COMPLETE';
  $('progress-label').textContent = 'ROUND COMPLETE';
  $('replay-progress').value = 1;
  $('rescued').textContent = `${runner.state.rescue.boarded} / 5 RESCUED`;
  $('result').textContent = `${(Number(payout) / Number(wager)).toFixed(2)}×`;
  $('status').textContent = `${runner.state.rescue.boarded} civilians rescued. Payout: ${visible(payout)} USDC.`;
  activeRunner = null;
  $('round-rescued').textContent=`${runner.state.rescue.boarded} / 5 civilians rescued`;
  $('round-return').textContent=`${visible(payout)} USDC`;
  $('round-multiplier').textContent=$('result').textContent;
  $('result-dialog').showModal();
}

async function start() {
  const loadingProgress = $('loading-progress');
  const loadingLabel = $('loading-label');
  const updateLoading = (done, total, label) => {
    loadingProgress.value = total ? Math.min(.85, .85 * done / total) : 0;
    loadingLabel.textContent = `${label}…`;
  };
  $('status').textContent = 'Loading the original Quick Play arena…';
  assets = await loadMsuAssets(updateLoading);
  loadingLabel.textContent = 'Loading characters…';
  useOriginalCharacterArt(assets, await loadOriginalCharacterArt((done, total) => {
    loadingProgress.value = total ? .85 + .14 * done / total : .85;
  }));
  renderer = createRenderer($('battlefield'), assets);
  audio.configure(assets);
  audio.start(audioSettings, false);
  showMath();
  startIdle();
  loadingProgress.value = 1;
  loadingLabel.textContent = 'Ready';
  document.body.classList.remove('is-loading');
  $('loading-screen').setAttribute('hidden', '');
  $('status').textContent = 'Ready to cast.';
  lock(embedded);
  if (embedded) {
    $('mode').textContent = 'CHAIN HOST'; $('balance-label').textContent = 'HOST BALANCE';
    $('balance').textContent = '—';
    const { createBridge } = await import('./bridge.mjs');
    bridge = createBridge({
      onSnapshot(snapshot) {
        if (Number.isInteger(snapshot?.token?.decimals)) decimals = snapshot.token.decimals;
        if (snapshot?.balances?.smartVaultBalance) showBalance(snapshot.balances.smartVaultBalance);
        else $('balance').textContent = '—';
      },
      onStatus(message) {
        if (message === 'ready') { lock(false); if (!activeRunner) $('status').textContent = 'Ready to cast.'; }
        else { lock(true); $('status').textContent = message; }
      },
      onRound: playRound,
    });
  }
}

$('controls').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  $('error').textContent = '';
  try {
    const wager = parseAmount($('wager').value, decimals);
    const formation = Number($('formation').value);
    if (embedded) {
      if (!bridge) throw Error('Waiting for the Chain host.');
      lock(true); await bridge.cast(wager, formation); return;
    }
    demo.start(wager, formation); lock(true); showBalance(demo.balance);
    const outcomeIndex = sampleOutcome();
    const payout = originalPayoutFor(wager, formation, outcomeIndex);
    await playRound({ formation, outcomeIndex, payout, wager });
    demo.settle(payout); showBalance(demo.balance); lock(false);
  } catch (error) { $('error').textContent = error.message; audio.stop(); lock(embedded || demo.phase !== 'ready'); }
});
$('formation').addEventListener('change', showMath);
$('play-again').addEventListener('click',()=>{
  if (busy) return;
  $('result-dialog').close();
  idleState = createOriginalScenario(Number($('formation').value), 0).state;
  $('wave').textContent='READY TO CAST';
  $('rescued').textContent='0 / 5 RESCUED';
  $('progress-label').textContent='READY TO CAST';
  $('replay-progress').value=0;
  $('status').textContent='Ready to cast.';
  renderer.draw(idleState,{reducedMotion});
  startIdle();
});
$('sound').addEventListener('click', async () => {
  audioSettings.mute = !audioSettings.mute;
  audio.update(audioSettings);
  if (!audioSettings.mute) await audio.unlock();
  $('sound').textContent = audioSettings.mute ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-pressed', String(!audioSettings.mute));
});
window.addEventListener('pointerdown', () => { void audio.unlock(); }, { once: true, passive: true });
window.addEventListener('keydown', () => { void audio.unlock(); }, { once: true, passive: true });
start().catch(error => {
  $('loading-label').textContent = `Unable to load game: ${error.message}`;
  $('loading-screen').classList.add('has-error');
  $('error').textContent = error.message;
  $('status').textContent = 'Game assets failed to load.';
});
