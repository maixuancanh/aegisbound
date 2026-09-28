import { connectGameToHost } from '@chain/casino-sdk/guest';
import { decodeAbiParameters, encodeAbiParameters, keccak256 } from 'viem';
import { originalPayoutFor as payoutFor, originalStatistics as statistics,
  originalScoreFor as scoreFor } from './game/original-outcome-table.mjs';
import { ORIGINAL_OUTCOME_COUNT as OUTCOME_COUNT, ORIGINAL_RULES_VERSION as RESCUE_RULES_VERSION } from './game/original-scenario.mjs';

const MIN_WAGER = 100n, MAX_WAGER = 10n ** 24n;
const FORMATIONS = [{ id: 0 }, { id: 1 }];

const INPUT = [{ type: 'uint256' }];
// contracts/BorrowedAegisAuto.sol: complete settled state encoding.
const STATE = [{ type: 'uint8' }, { type: 'uint8' }, { type: 'uint32' }, { type: 'uint256' },
  { type: 'uint8' }, { type: 'bytes32' }];
const COMMITMENT = [{ type: 'uint8' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'uint256' }];
const PREFIX = 'borrowed-aegis.bridge.v1:';
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const terminal = row => [3, 4, 5].includes(row.phase) || row.isSettled === true;
let shared;

function natural(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || value.length > 78) throw Error('Missing or invalid host amount.');
  return BigInt(value);
}
function formationOf(data) {
  if (typeof data !== 'string' || data.length !== 66) throw Error('Invalid formation encoding.');
  const [f] = decodeAbiParameters(INPUT, data);
  if (!FORMATIONS.some(item => BigInt(item.id) === f)) throw Error('Unknown formation.');
  return Number(f);
}
function scopeOf(snapshot) {
  const integration = snapshot?.integration, wallet = snapshot?.wallet;
  const account = wallet?.smartVaultAddress ?? wallet?.address;
  if (snapshot?.apiVersion !== 1 || !Number.isSafeInteger(integration?.chainId) || integration.chainId <= 0 ||
      !ADDRESS.test(integration?.gameAddress) || !ADDRESS.test(account)) return null;
  return `${integration.chainId}:${integration.gameAddress.toLowerCase()}:${account.toLowerCase()}`;
}
function bounded(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(message)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
function notify(s, message) {
  s.status = message;
  for (const client of s.clients) {
    try { client.onStatus?.(message); } catch { /* UI observers cannot break the lock. */ }
  }
}
function persist(s) {
  // Persist before open: unavailable storage must fail closed for reload safety.
  sessionStorage.setItem(PREFIX + s.scope, JSON.stringify(s.journal));
}
function rowsOf(s) {
  const rows = s.snapshot?.sessions?.items;
  if (!Array.isArray(rows) || rows.length > 256) throw Error('Session feed unavailable or exceeds 256 rows.');
  return rows.filter(row => row?.gameAddress?.toLowerCase() === s.snapshot.integration.gameAddress.toLowerCase());
}
function syncScope(s) {
  const scope = scopeOf(s.snapshot);
  if (!scope) throw Error('Waiting for a valid host identity.');
  if (s.scope === scope) return;
  if (s.journal && !s.journal.done) throw Error('Host identity changed during a round; restore the original account and game.');
  s.scope = scope;
  s.journal = null;
  const raw = sessionStorage.getItem(PREFIX + scope);
  if (raw) {
    const journal = JSON.parse(raw);
    if (!journal || typeof journal !== 'object' || !Array.isArray(journal.before) || journal.before.length > 256 ||
        !FORMATIONS.some(f => f.id === journal.formation) || natural(journal.wager) < MIN_WAGER ||
        natural(journal.wager) > MAX_WAGER || (journal.key !== null && typeof journal.key !== 'string')) {
      throw Error('Invalid saved round; recovery requires inspection.');
    }
    s.journal = journal;
  }
}
function validRow(row, s) {
  return typeof row.sessionId === 'string' && /^\d+$/.test(row.sessionId) &&
    row.sessionKey === `${s.snapshot.integration.chainId}:${row.sessionId}`;
}
function recover(s, rows) {
  if (s.opening) return;
  if (s.journal && !s.journal.done) {
    if (!s.journal.key) {
      const candidates = rows.filter(row => validRow(row, s) && !s.journal.before.includes(row.sessionKey) &&
        row.wager === s.journal.wager && row.raw?.gameData === encodeAbiParameters(INPUT, [BigInt(s.journal.formation)]));
      if (candidates.length === 1) { s.journal.key = candidates[0].sessionKey; persist(s); }
    }
    return;
  }
  const active = rows.filter(row => !terminal(row));
  if (active.length > 1) throw Error('Multiple pending rounds require recovery before casting.');
  if (active.length === 1) {
    const row = active[0];
    if (!validRow(row, s)) throw Error('Waiting for a confirmed session identity.');
    if (row.sessionKey === s.journal?.key) throw Error('Session feed regressed; waiting for settlement.');
    const wager = natural(row.wager);
    if (wager < MIN_WAGER || wager > MAX_WAGER) throw Error('Invalid recovered wager.');
    s.journal = { key: row.sessionKey, wager: wager.toString(), formation: formationOf(row.raw?.gameData), before: [], done: false };
    persist(s);
  }
}
async function pump(s) {
  if (s.processing || s.opening || !s.api || !s.clients.size) return;
  try {
    syncScope(s);
    const rows = rowsOf(s);
    recover(s, rows);
    const journal = s.journal;
    if (!journal || journal.done) { notify(s, s.snapshot.wallet.status === 'ready' ? 'ready' : 'Wallet is not ready.'); return; }
    const row = rows.find(row => row.sessionKey === journal.key);
    if (!journal.key) { notify(s, 'Open status is unknown. Check the host session history before trying another cast.'); return; }
    if (!row || !terminal(row)) { notify(s, 'Waiting for the host to confirm and settle the round.'); return; }
    if (!validRow(row, s)) throw Error('Invalid settled session identity.');
    if ([4, 5].includes(row.phase)) {
      throw Error(`Round ${row.sessionId} was ${row.phase === 4 ? 'forfeited' : 'cancelled'}; inspect host recovery before casting.`);
    }
    if (row.phase !== 3 || typeof row.raw?.gameState !== 'string' || row.raw.gameState.length !== 386) {
      throw Error('Waiting for complete settled contract state.');
    }
    const [phase, formation, step, outcome, version, commitment] = decodeAbiParameters(STATE, row.raw.gameState);
    const wager = natural(row.wager), payout = natural(row.payout);
    const score = outcome < BigInt(OUTCOME_COUNT) ? scoreFor(formation, Number(outcome)) : -1;
    const expectedCommitment = score < 0 ? null : keccak256(encodeAbiParameters(COMMITMENT,
      [RESCUE_RULES_VERSION, formation, outcome, BigInt(score)]));
    if (phase !== 3 || step < 2 || formation !== journal.formation || outcome >= BigInt(OUTCOME_COUNT) ||
        wager.toString() !== journal.wager || formationOf(row.raw.gameData) !== formation ||
        version !== RESCUE_RULES_VERSION || commitment !== expectedCommitment ||
        payout !== payoutFor(wager, formation, Number(outcome))) throw Error('Settled state does not match the locked wager and contract math.');
    const client = [...s.clients].at(-1);
    if (typeof client.onRound !== 'function') throw Error('A round presenter is required before revealing.');
    if (s.failedKey === journal.key) return;
    s.processing = true;
    const scope = s.scope;
    notify(s, 'Presenting settled round.');
    try {
      await client.onRound({ sessionId: row.sessionId, wager, payout, formation, outcomeIndex: Number(outcome) });
      if (!s.clients.has(client) || scopeOf(s.snapshot) !== scope) return;
      await bounded(s.api.revealOutcome({ sessionId: row.sessionId }), 15000, 'Reveal timed out; round remains locked.');
      journal.done = true;
      persist(s);
      notify(s, 'ready');
    } catch (error) {
      s.failedKey = journal.key;
      notify(s, error.message || 'Round presentation or reveal failed.');
    } finally { s.processing = false; }
  } catch (error) { notify(s, error.message || 'Bridge unavailable.'); }
}
function connection() {
  if (shared) return shared;
  const s = shared = { clients: new Set(), api: null, snapshot: null, journal: null, scope: null,
    opening: false, processing: false, failedKey: null, status: 'Waiting for host.' };
  if (typeof window === 'undefined' || window.parent === window) {
    s.status = 'Host bridge is available only inside an iframe.';
    return s;
  }
  try {
    s.connection = connectGameToHost({ async setState(snapshot) {
      s.snapshot = snapshot;
      for (const client of s.clients) {
        try { client.onSnapshot?.(snapshot); } catch { /* Keep consuming authoritative state. */ }
      }
      // Never hold the SDK snapshot RPC open for a frontend animation.
      void pump(s);
    } });
    void bounded(s.connection.promise, 15000, 'Host handshake timed out; reload to reconnect.').then(api => {
      s.api = api;
      if (api.reportContentSize && typeof document !== 'undefined') {
        const report = () => {
          const minHeight = Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0));
          void api.reportContentSize({ minHeight }).catch(() => {});
        };
        if (typeof ResizeObserver !== 'undefined') {
          s.resizeObserver = new ResizeObserver(report);
          s.resizeObserver.observe(document.documentElement);
          if (document.body) s.resizeObserver.observe(document.body);
        }
        report();
      }
      void pump(s);
    }).catch(error => notify(s, error.message));
  } catch (error) { notify(s, error.message); }
  return s;
}

/**
 * One SDK connection per page; last mounted client presents rounds.
 * onStatus receives a human-readable string. onRound may return a Promise;
 * reveal happens only after it fulfills. cast resolves to the SDK open result.
 * close unsubscribes this client, preserving the connection and shared lock.
 * No wallet/RPC access: every transaction request goes through the host API.
 */
export function createBridge({ onSnapshot, onRound, onStatus } = {}) {
  const s = connection(), client = { onSnapshot, onRound, onStatus };
  s.clients.add(client);
  try { onSnapshot?.(s.snapshot); onStatus?.(s.status); } catch { /* Observer isolation. */ }
  void pump(s);
  return {
    async cast(wager, formation) {
      if (!s.clients.has(client)) throw Error('Bridge is closed.');
      if (!s.api || !s.snapshot) throw Error('Host bridge is not ready.');
      if (s.opening || s.processing) throw Error('A round is already running.');
      syncScope(s);
      const rows = rowsOf(s);
      recover(s, rows);
      if (s.journal && !s.journal.done) throw Error('A round is pending or requires recovery.');
      if (s.snapshot.wallet.status !== 'ready') throw Error('Wallet is not ready.');
      if (typeof wager !== 'bigint' || wager < MIN_WAGER || wager > MAX_WAGER) throw Error('Wager is outside the contract domain.');
      if (!Number.isInteger(formation) || !FORMATIONS.some(f => f.id === formation)) throw Error('Unknown formation.');
      if (wager > natural(s.snapshot.balances?.smartVaultBalance)) throw Error('Insufficient host balance.');
      const casino = s.snapshot.casino;
      const cap = natural(casino?.maxAllowedReservedProfit);
      const ceiling = casino.maxBetAmount === undefined ? 0n : natural(casino.maxBetAmount);
      const reserved = statistics(formation, wager).maxPayout - wager;
      if ((ceiling > 0n && wager > ceiling) || reserved > cap) throw Error('Wager exceeds host risk limits.');
      const journal = { key: null, wager: wager.toString(), formation, before: rows.map(row => row.sessionKey), done: false };
      s.journal = journal;
      persist(s);
      s.opening = true;
      s.failedKey = null;
      notify(s, 'Opening round.');
      try {
        const result = await bounded(s.api.openSession({ wager: wager.toString(), gameData: encodeAbiParameters(INPUT, [BigInt(formation)]) }),
          30000, 'Open timed out; outcome is unknown. Do not retry.');
        if (!result || typeof result.sessionKey !== 'string' || !new RegExp(`^${s.snapshot.integration.chainId}:\\d+$`).test(result.sessionKey)) {
          throw Error('Host returned an invalid session key; recovery required.');
        }
        journal.key = result.sessionKey;
        persist(s);
        return result;
      } catch (error) {
        // Even a rejected transport call might have reached the chain. Never retry it.
        notify(s, error.message || 'Open result unknown; recovery required.');
        throw error;
      } finally { s.opening = false; void pump(s); }
    },
    close() { s.clients.delete(client); },
  };
}
