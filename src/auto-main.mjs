import { RESCUE_FORMATIONS, simulateRescue } from './game/auto-rescue.mjs';
import { rescuePayoutFor, rescueStatistics } from './game/auto-rescue-math.mjs';
import { createRoundState, sampleOutcome } from './round-state.mjs';
import { parseAmount, formatAmount } from './amounts.mjs';
import { createRescueAudio } from './rescue-audio.mjs';
import { createAutoRescueScene } from './scene/auto-rescue-scene.mjs';
import { replayProgress } from './game/replay-progress.mjs';

const $ = id => document.getElementById(id);
const embedded = window.parent !== window;
const demo = createRoundState(100000n);
const sound = createRescueAudio();
const scene = createAutoRescueScene($('battlefield'), import.meta.env.BASE_URL);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let bridge, busy = false, decimals = 2;

function lock(value) {
  busy = value;
  for (const id of ['cast', 'formation', 'wager']) $(id).disabled = value;
  $('controls').setAttribute('aria-busy', String(value));
}
function format(value) { return formatAmount(value, decimals); }
function visible(value) {
  const [whole, fraction = ''] = format(value).split('.');
  return BigInt(whole).toLocaleString('en-US') + (decimals ? '.' + fraction.padEnd(2, '0').slice(0, 2) : '');
}
function showBalance(value) {
  $('balance').textContent = visible(value);
  $('balance').title = `Exact balance: ${format(value)}`;
}
function updateMath() {
  const formation = Number($('formation').value);
  const stats = rescueStatistics(formation, 10000n);
  $('math-summary').textContent = `${RESCUE_FORMATIONS[formation].name}: five civilians, three automatic waves. ` +
    `Every rescue event follows the settled outcome. RTP ${(stats.rtp * 100).toFixed(2)}% at 100 credits; ` +
    'small wagers round down in base units. All 729 outcomes are equally likely.';
  $('paytable').textContent = stats.distribution.map(row =>
    `Score ${row.score}: ${(Number(row.payout) / 10000).toFixed(4)}× · ${row.count}/729 outcomes`).join('\n');
  scene.draw();
}
const feedback = event => {
  if (event.type === 'board' || event.type === 'civilian-lost') {
    const rescued = Number($('rescued').dataset.count || 0) + (event.type === 'board' ? 1 : 0);
    $('rescued').dataset.count = String(rescued);
    $('rescued').textContent = `${rescued} / 5 RESCUED`;
  }
  if (event.type === 'throw') sound.play('cast');
  if (event.type === 'capture') sound.play('capture');
  if (event.type === 'block') sound.play('block');
  if (event.type === 'civilian-lost') sound.play('breach');
  if (['armor-break', 'capture', 'board', 'shield-break', 'civilian-lost'].includes(event.type)) {
    const label = { 'armor-break': 'Armor broken', capture: 'Enemy captured as its own shield',
      board: 'Civilian boarded', 'shield-break': 'Shield destroyed', 'civilian-lost': 'Civilian lost' }[event.type];
    $('status').textContent = `${label} · ${event.sourceId}`;
  }
  $('wave').textContent = `WAVE ${event.wave + 1} / 3`;
};
async function playRound({ formation, outcomeIndex, payout, wager }) {
  if (payout !== rescuePayoutFor(wager, formation, outcomeIndex)) throw Error('Payout does not match the rescue trace.');
  const round = simulateRescue(formation, outcomeIndex);
  $('formation').value = String(formation);
  $('rescued').dataset.count = '0'; $('rescued').textContent = '0 / 5 RESCUED';
  $('status').textContent = 'Evacuation in progress…';
  $('progress-label').textContent = 'EVACUATION IN PROGRESS';
  $('replay-progress').value = 0;
  lock(true);
  let completedEvents = 0;
  await scene.replay(round.events, event => {
    feedback(event);
    $('replay-progress').value = replayProgress(++completedEvents, round.events.length);
  }, reduced);
  $('wave').textContent = 'ROUND COMPLETE';
  $('progress-label').textContent = 'ROUND COMPLETE';
  $('rescued').textContent = `${round.boarded} / 5 RESCUED`;
  $('result').textContent = `${(Number(payout) / Number(wager)).toFixed(2)}×`;
  $('status').textContent = `${round.boarded} ${round.boarded === 1 ? 'civilian' : 'civilians'} rescued. Return: ${visible(payout)} ${embedded ? 'tokens' : 'demo credits'}.`;
  sound.play(round.boarded ? 'win' : 'breach');
  // In the host, revealOutcome must complete before another cast is permitted.
  // In standalone, settle the demo balance before unlocking.
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
    const payout = rescuePayoutFor(wager, formation, outcomeIndex);
    await playRound({ formation, outcomeIndex, payout, wager });
    demo.settle(payout); showBalance(demo.balance);
    lock(false);
  } catch (error) {
    $('error').textContent = error.message;
    lock(embedded);
  }
});
$('formation').addEventListener('change', () => { sound.play('select'); updateMath(); });
$('sound').addEventListener('click', () => {
  const enabled = sound.toggle();
  $('sound').textContent = enabled ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(enabled)); sound.play('select');
});
updateMath();
if (embedded) {
  $('mode').textContent = 'CHAIN HOST'; $('balance-label').textContent = 'HOST BALANCE';
  $('balance').textContent = '—'; $('status').textContent = 'Connecting to the Chain host…'; lock(true);
  import('./bridge.mjs').then(({ createBridge }) => {
    bridge = createBridge({
      onSnapshot(snapshot) {
        if (Number.isInteger(snapshot?.token?.decimals)) decimals = snapshot.token.decimals;
        if (snapshot?.balances?.smartVaultBalance) showBalance(snapshot.balances.smartVaultBalance);
        else $('balance').textContent = '—';
      },
      onStatus(message) {
        if (message === 'ready') lock(false);
        else { lock(true); $('status').textContent = message; }
      },
      onRound: playRound,
    });
  }).catch(error => { $('error').textContent = `Host unavailable: ${error.message}`; });
}
