# Borrowed Aegis: short Quick Play settlement math

The active Chain Jam round runs the preserved Kinesis rescue engine with a short scenario profile. One 60 Hz engine tick is shown per frame. Five civilians begin at one point, two enemies appear at ticks 55 and 235, and the rescue vehicle arrives from the right. Every measured run ends between ticks 480 and 600. Armor, capture, shield return, boarding, and departure remain original-engine events, not renderer inventions.

The contract draws one of 729 equally likely outcomes with rejection sampling; outcome `n` selects short-scenario seed `(n % 27) + 1`. Bastion uses a 50-tick shield-pickup cadence, Sweep uses 52 ticks and civilians move eight world units per second slower. These rules are version 4. The separate original game and `legacy-kinesis/src` are unchanged.

`src/game/original-outcome-table.mjs` records exact civilians boarded by all 27 seeds under each formation. `tests/original-scenario.test.mjs` replays all 54 pairs and checks every entry. Each seed appears exactly 27 times among the 729 outcomes. Contract bytes `BASTION` and `SWEEP` mirror the measured table; parity tests compare every outcome, score, and integer payout.

| Civilians boarded | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| Score | 0 | 1 | 3 | 7 | 15 | 40 |

The gross payout includes the wager:

`floor(wager × score × 2565 / (100 × scoreSum))`

`scoreSum` is 506 for Bastion and 426 for Sweep. At a 10,000-base-unit wager, exhaustive RTP is 94.9933% for Bastion and 94.9948% for Sweep after integer rounding. The accepted wager interval is 100 through 10^24 base units. `originalStatistics` provides exact probability counts and risk quotes; the contract uses the same counts and rounding.

The settled contract state contains phase, formation, step, outcome, rules version 4, and `keccak256(abi.encode(version, formation, outcome, score))`. The bridge checks commitment and payout before playback. After the complete engine run, the presenter checks its boarded count against the contract table before revealing. A mismatch blocks reveal. The commitment binds score, not an event-by-event transcript, so code and table must remain versioned together.

The previous scripted `auto-rescue.mjs` presenter remains for migration history but is not imported by the active page. Local tests do not establish live Chain settlement or public submission. Redistribution rights for original media still require review.
