// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICasinoGameV2, SessionContext, StepResult, SessionPhase} from "../third_party/chain-casino-sdk/ICasinoGameV2.sol";

/// @notice Bounded automatic rescue. The frontend replays the same versioned outcome.
contract BorrowedAegisAuto is ICasinoGameV2 {
    struct RiskMoments { uint256 sum; uint256 bodySum; uint256 bodySquares; uint256 topCount; }
    uint256 public constant MIN_WAGER = 100;
    uint256 public constant MAX_WAGER = 1e24;
    uint256 public constant OUTCOME_COUNT = 729;
    bytes27 private constant BASTION = hex"010102020202030303030303040505040404040405050505050505";
    bytes27 private constant SWEEP = hex"000001010202020203030303030304050504040404040505050505";
    uint256 private constant MAX_SCORE = 40;
    error InvalidFormation();
    error InvalidWager();
    error InvalidState();
    error InvalidOutcome();
    error NoPlayerActions();

    function rulesVersion() external pure returns (uint8) { return 4; }
    function traceCommitment(uint8 formation, uint256 outcome) public pure returns (bytes32) {
        return keccak256(abi.encode(uint8(4), formation, outcome, scoreFor(formation, outcome)));
    }
    function _formation(bytes calldata data) private pure returns (uint8) {
        if (data.length != 32) revert InvalidFormation();
        uint256 raw = abi.decode(data, (uint256));
        if (raw > 1) revert InvalidFormation();
        return uint8(raw);
    }
    function _wager(uint256 wager) private pure {
        if (wager < MIN_WAGER || wager > MAX_WAGER) revert InvalidWager();
    }
    function boardedFor(uint8 formation, uint256 outcome) public pure returns (uint256) {
        if (formation > 1) revert InvalidFormation();
        if (outcome >= OUTCOME_COUNT) revert InvalidOutcome();
        return uint8((formation == 0 ? BASTION : SWEEP)[outcome % 27]);
    }
    function scoreFor(uint8 formation, uint256 outcome) public pure returns (uint256) {
        return _score(boardedFor(formation, outcome));
    }
    function _score(uint256 boarded) private pure returns (uint256) {
        if (boarded == 5) return 40;
        if (boarded == 4) return 15;
        if (boarded == 3) return 7;
        if (boarded == 2) return 3;
        return boarded;
    }
    function distribution(uint8 formation) public pure returns (uint16[6] memory counts) {
        if (formation > 1) revert InvalidFormation();
        for (uint256 i; i < 27; ++i) counts[boardedFor(formation, i)] += 27;
    }
    function _scoreSum(uint8 formation) private pure returns (uint256) {
        if (formation > 1) revert InvalidFormation();
        return formation == 0 ? 506 : 426;
    }
    function payoutFor(uint256 wager, uint8 formation, uint256 outcome) public pure returns (uint256) {
        _wager(wager);
        return _payout(wager, formation, scoreFor(formation, outcome));
    }
    function _payout(uint256 wager, uint8 formation, uint256 score) private pure returns (uint256) {
        return wager * score * 2565 / (100 * _scoreSum(formation));
    }
    function _max(uint256 wager, uint8 formation) private pure returns (uint256) {
        return wager * MAX_SCORE * 2565 / (100 * _scoreSum(formation));
    }
    function quoteCaps(uint256 wager, bytes calldata data) external pure override returns (uint256, uint256) {
        _wager(wager); uint8 f = _formation(data);
        return (wager, _max(wager, f) - wager);
    }
    function quoteRiskParams(uint256 wager, bytes calldata data) external pure override returns (
        uint256 maxPayout, uint256 probabilityWad, uint256 expectedPayout, uint256 bodyVarianceScaled
    ) {
        _wager(wager); uint8 f = _formation(data);
        maxPayout = _max(wager, f);
        uint16[6] memory counts = distribution(f);
        RiskMoments memory m;
        for (uint256 boarded; boarded < 6; ++boarded) {
            uint256 p = _payout(wager, f, _score(boarded));
            uint256 count = counts[boarded];
            m.sum += p * count;
            if (p == maxPayout) m.topCount += count;
            else { m.bodySum += p * count; m.bodySquares += p * p * count; }
        }
        probabilityWad = m.topCount * 1e18 / OUTCOME_COUNT;
        expectedPayout = m.sum / OUTCOME_COUNT;
        bodyVarianceScaled = (OUTCOME_COUNT * m.bodySquares - m.bodySum * m.bodySum) * 1e18 / (OUTCOME_COUNT * OUTCOME_COUNT);
    }
    function onSessionStart(SessionContext calldata ctx) external pure override returns (StepResult memory r) {
        _wager(ctx.wagerBase); uint8 f = _formation(ctx.gameData);
        if (ctx.step != 0 || ctx.gameState.length != 0 || ctx.escrowedStake != ctx.wagerBase || ctx.reservedProfit != 0) revert InvalidState();
        r.newGameState = abi.encode(uint8(SessionPhase.WAITING_RANDOMNESS), f, uint32(1), uint256(0));
        r.reservedProfitDelta = int256(_max(ctx.wagerBase, f) - ctx.wagerBase);
        r.nextPhase = SessionPhase.WAITING_RANDOMNESS; r.requestRandomnessNow = true;
    }
    function onPlayerAction(SessionContext calldata, bytes calldata) external pure override returns (StepResult memory) {
        revert NoPlayerActions();
    }
    function _pending(SessionContext calldata ctx) private pure returns (uint8 f) {
        _wager(ctx.wagerBase); f = _formation(ctx.gameData);
        if (ctx.gameState.length != 128) revert InvalidState();
        (uint8 phase, uint8 locked, uint32 expectedStep, uint256 marker) = abi.decode(ctx.gameState, (uint8,uint8,uint32,uint256));
        if (phase != uint8(SessionPhase.WAITING_RANDOMNESS) || locked != f || expectedStep != ctx.step ||
            ctx.step == 0 || marker != 0 || ctx.escrowedStake != ctx.wagerBase ||
            ctx.reservedProfit != _max(ctx.wagerBase, f) - ctx.wagerBase) revert InvalidState();
    }
    function outcomeFromRandomness(bytes32 randomness) public pure returns (bool accepted, uint256 outcome) {
        uint256 threshold = addmod(type(uint256).max, 1, OUTCOME_COUNT);
        uint256 x = uint256(randomness);
        return (x >= threshold, x % OUTCOME_COUNT);
    }
    function onRandomness(SessionContext calldata ctx, bytes32 randomness) external pure override returns (StepResult memory r) {
        uint8 f = _pending(ctx);
        (bool accepted, uint256 outcome) = outcomeFromRandomness(randomness);
        if (!accepted) {
            r.newGameState = abi.encode(uint8(SessionPhase.WAITING_RANDOMNESS), f, ctx.step + 1, uint256(0));
            r.nextPhase = SessionPhase.WAITING_RANDOMNESS; r.requestRandomnessNow = true;
        } else {
            r.payout = payoutFor(ctx.wagerBase, f, outcome);
            r.newGameState = abi.encode(uint8(SessionPhase.SETTLED), f, ctx.step + 1, outcome,
                uint8(4), traceCommitment(f, outcome));
            r.nextPhase = SessionPhase.SETTLED;
        }
    }
    function quoteForfeitPayout(SessionContext calldata ctx) external pure override returns (uint256) {
        _pending(ctx); return 0;
    }
}
