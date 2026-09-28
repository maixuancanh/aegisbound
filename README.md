# Aegisbound

Aegisbound is an automatic rescue game built for Chain Jam. Choose a formation and a wager, then watch a guardian protect five civilians on their way to an evacuation van. Thrown shields break enemy armor; captured enemies return as new shields. The number of civilians who board the van determines the payout.

[Play Aegisbound](https://aegisbound.pages.dev/)

The standalone game uses a simulated USDC balance, starting at 1,000 and resetting when the page reloads. It does not connect a wallet or transfer real funds. This repository also includes a Solidity game contract and the Chain iframe bridge. Public hosting is separate from contract deployment and casino integration.

## How to play

1. Wait for the logo and loading bar to finish. The game and controls appear after the required assets load.
2. Choose **Bastion** or **Sweep** and enter a wager.
3. Click **CAST AEGIS** to begin a round.
4. Watch the rescue. Movement, shield throws, captures and boarding happen automatically; there are no mid-round controls.
5. The van leaves the screen before the result panel shows the payout, multiplier and rescued civilians.
6. Click **CONTINUE** to return to the ready screen. A new round starts only when you click **CAST AEGIS** again.

The short Quick Play scenario has five civilians and two staggered enemy arrivals. The simulation runs one tick per rendered frame and finishes within 480–600 ticks, roughly 8–10 seconds at 60 fps, followed by the van's departure. Slower frame rates can make playback take longer. Shield effects continue animating while the game is idle.

The guardian, enemies, civilians and van use replacement artwork. The original Quick Play engine supplies movement, combat, shielding and rescue behavior. Animation frames use atlas rectangles rather than assuming every picture fits an equal-sized grid.

Background music is `YggdrasilPrayer.mp3`, looped at 25% volume. Browsers that block autoplay require a user interaction before audio can start.

## Run locally

Use Node.js 24.14 or later and npm.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4322/](http://127.0.0.1:4322/). The dev server uses a fixed port and fails if another process already occupies it. To use a different port:

```sh
npm run dev -- --host 127.0.0.1 --port 4323
```

No wallet, RPC endpoint or environment variables are needed for standalone play.

```sh
npm run build
```

The production files are written to `dist/`. Serve that directory over HTTP; do not open its HTML file directly from the filesystem.

## Formations and payouts

Settlement rules version 4 has 729 equally likely outcomes. Each outcome selects one of 27 replay seeds through `(outcome % 27) + 1`. Both formations use the same engine with different timing parameters. Bastion has a 50-tick pickup interval; Sweep has a 52-tick interval and civilian movement is 8 units per second slower.

The contract uses measured rescue results for every seed and formation. It does not choose an independent prize after the animation ends.

| Civilians rescued | Score | Bastion gross multiplier | Sweep gross multiplier |
| --- | ---: | ---: | ---: |
| 0 | 0 | Not reached by this seed table | 0× |
| 1 | 1 | 0.0506× | 0.0602× |
| 2 | 3 | 0.1520× | 0.1806× |
| 3 | 7 | 0.3548× | 0.4214× |
| 4 | 15 | 0.7603× | 0.9031× |
| 5 | 40 | 2.0276× | 2.4084× |

The table is calculated at a wager of 10,000 contract base units. Integer rounding can affect smaller wagers; the UI rounds displayed amounts and multipliers to two decimal places. A payout includes the wager, so a multiplier below 1× is a net loss.

```text
payout = floor(wager × score × 2565 / (100 × scoreSum))
scoreSum = 506 for Bastion, 426 for Sweep
```

At a 10,000-unit wager, theoretical RTP is approximately 94.9933% for Bastion and 94.9948% for Sweep. RTP is an average over the complete outcome distribution, not a promise about an individual round. The contract accepts wagers from 100 to 10^24 base units; an integrating host can impose narrower limits.

See [the payout math](docs/MATH.md), [the outcome table](src/game/original-outcome-table.mjs) and [the contract](contracts/BorrowedAegisAuto.sol) for the exact rules.

## Chain SDK integration

The historical contract and manifest identifier is `BorrowedAegisAuto`. The game's display name is Aegisbound.

In a Chain host iframe, the bridge receives the settled result and validates the rules version, formation, payout and commitment before playback. It then replays the selected seed and checks that the actual boarding result matches settlement. Reveal waits for playback to finish; a mismatch blocks the normal completion flow.

The commitment binds the rules version, formation, outcome and rescue score. It is not a hash of every rendered frame or a full event transcript. Visual effects do not change the contract payout.

Four SDK files are included in `third_party/chain-casino-sdk/`, so a fresh checkout can build without downloading the full SDK. The optional local simulator and EVM parity script need the SDK workspace at `vendor/chain-sdk/casino-sdk/`.

### Local simulator

Download the [Chain casino SDK](https://sdk.chain.wtf/sdk/casino-sdk.zip), install its dependencies and place its workspace at the path above.

1. Copy `contracts/BorrowedAegisAuto.sol` into the simulator's `contracts/` directory. Its interface import resolves through the simulator's `ICasinoGameV2.sol` fallback.
2. In the simulator directory, start the local node:

   ```powershell
   $env:RPC_URL = 'http://127.0.0.1:18545'
   npm run local-node
   ```

3. In another terminal in the same directory, start the harness:

   ```sh
   npm run dev -- --port 13300 --strictPort
   ```

4. Open the harness with `game=http://127.0.0.1:4322/`, `rpc=http://127.0.0.1:18545` and the newly deployed contract address from `simulator/local-node/deployed.json`.

Use local test funds only. Restarting the local chain can change the deployed address. A successful simulator test does not establish public-chain deployment or acceptance by Chain.

## Repository layout

```text
contracts/                  Solidity settlement contract
src/original-main.mjs        Active page, round lifecycle and controls
src/game/                   Deterministic scenario, replay and outcome tables
src/scene/                  Renderer and replacement-character atlas mapping
src/bridge/                 Chain host communication
legacy-kinesis/src/         Preserved Quick Play engine dependencies
public/assets/              Images, atlas data, music and sound effects
public/game.manifest.json   Chain game manifest
third_party/                Vendored Chain SDK files
tests/                      Automated regression tests
scripts/                    Local verification utilities
docs/                       Payout math and asset provenance
```

Older rescue modules remain where they are required by regression tests. The active entry is `src/original-main.mjs`; those older modules are not a second playable mode.

## Tests

```sh
npm test
npm run build
```

The tests replay all 54 distinct seed/formation combinations and compare rescue results with the contract table. They also cover replay validation, round lifecycle, atlas rendering, loading visibility and presentation behavior. Build verification checks the production entry and bundled dependencies.

With the optional full SDK installed, run the contract parity check:

```sh
node scripts/auto-rescue-parity.mjs
```

This checks the Solidity result against the JavaScript rules on a local EVM. It is not a live-chain transaction test.

## Deploy to Cloudflare Pages

Build, authenticate Wrangler with your Cloudflare account, then deploy the static output:

```sh
npm run build
npx wrangler pages deploy dist --project-name aegisbound --branch main --commit-dirty=true
```

Use your own Pages project name when deploying a fork. The frontend is static; it does not need a backend to run standalone rounds. Deploying it does not deploy the Solidity contract.

## Assets and licensing

The project combines generated replacement artwork with reused MapleStory/MSU backgrounds, effects and sounds, plus the supplied `YggdrasilPrayer.mp3` music. [Asset provenance](docs/ASSET-PROVENANCE.md) records the sources and remaining licensing questions.

Source access does not grant ownership or redistribution rights to third-party media. Review those rights before redistributing assets or submitting the game for casino integration. The contract's MIT SPDX identifier is not a blanket license for all artwork, audio or vendored SDK code.
