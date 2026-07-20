/**
 * @file The risk engine orchestrator. Combines every risk component
 * into a single `evaluate(decisionInput)` call that returns a
 * complete {@link import('./types.js').ExecutionPlan}. This is the
 * module's primary integration point for the Execution Engine.
 * @module risk-engine/RiskEngine
 */

import { createConfig } from './Config.js';
import { computePositionSize } from './PositionSizing.js';
import { computeAtrStopLoss, applyBreakEven, applyTrailingStop } from './StopLoss.js';
import { computeTakeProfitTargets, computeBlendedRiskReward, meetsMinimumRiskReward } from './TakeProfit.js';
import { computePortfolioHeat } from './PortfolioHeat.js';
import { ExposureManager } from './ExposureManager.js';
import { computeAdjustedLeverage } from './LeverageManager.js';
import { DrawdownManager } from './DrawdownManager.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { CooldownManager } from './CooldownManager.js';
import { computeRiskScore } from './RiskScore.js';
import { validateTrade } from './Validation.js';

/**
 * The institutional risk engine. Stateful components (exposure,
 * drawdown, circuit breaker, cooldown) are owned internally and
 * updated by the Execution/Learning Engine via the public
 * `record*`/`open*`/`close*` methods; `evaluate()` itself is a pure
 * function of the current state plus the incoming decision.
 */
export class RiskEngine {
  /**
   * @param {Object} [overrides] - Partial config overrides, deep-merged onto the defaults. See Config.js.
   */
  constructor(overrides = {}) {
    /** @type {import('./Config.js').RiskEngineConfig} */
    this.config = createConfig(overrides);

    /** @type {ExposureManager} */
    this.exposureManager = new ExposureManager(this.config.exposure);
    /** @type {DrawdownManager} */
    this.drawdownManager = new DrawdownManager(this.config.drawdown);
    /** @type {CircuitBreaker} */
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker, this.config.dailyLimits);
    /** @type {CooldownManager} */
    this.cooldownManager = new CooldownManager(this.config.cooldown);

    /** @private @type {Map<string, {winRate:number, avgWinPct:number, avgLossPct:number, sampleSize:number}>} */
    this._tradeStatsBySymbol = new Map();
  }

  /**
   * Feed the current account equity (called whenever equity changes —
   * typically after every fill). Required before `evaluate()` can size
   * positions or assess drawdown correctly.
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this.drawdownManager.recordEquity(equity, timestamp);
  }

  /**
   * Register a newly opened position (called by the Execution Engine
   * immediately after a fill).
   * @param {import('./types.js').OpenPosition} position
   * @returns {void}
   */
  openPosition(position) {
    this.exposureManager.openPosition(position);
    this.circuitBreaker.recordTradeOpened();
  }

  /**
   * Record a closed trade's result (called by the Execution/Learning
   * Engine). Updates exposure, circuit breaker, and cooldown state.
   * @param {import('./types.js').TradeResult} result
   * @returns {void}
   */
  recordTradeResult(result) {
    this.exposureManager.closePosition(result.symbol);
    this.circuitBreaker.recordTradeResult(result);
    this.cooldownManager.recordTradeResult(result);
  }

  /**
   * Provide updated historical win/loss statistics for a symbol, used
   * by Kelly-based position sizing (called by the Learning Engine).
   * @param {string} symbol
   * @param {import('./KellyCriterion.js').TradeStats} stats
   * @returns {void}
   */
  updateTradeStats(symbol, stats) {
    this._tradeStatsBySymbol.set(symbol, stats);
  }

  /**
   * Evaluate a Decision Engine output and produce a complete execution
   * plan: reject it outright, or size it, set stops/targets, and score
   * its risk.
   * @param {import('./types.js').DecisionInput} input
   * @returns {import('./types.js').ExecutionPlan}
   */
  evaluate(input) {
    const now = Date.now();
    const equity = input.equity;
    const drawdownPct = this.drawdownManager.getCurrentDrawdownPct();

    if (this.drawdownManager.isEquityProtectionTriggered() && !this.circuitBreaker.isTripped(now)) {
      this.circuitBreaker.trip('equity_protection_triggered', now);
    }

    const side = input.decision === 'SHORT' ? 'SHORT' : 'LONG';

    const stopLoss = computeAtrStopLoss({ side, entryPrice: input.entryPrice, atr: input.atr }, this.config.stopLoss);
    const takeProfitTargets = computeTakeProfitTargets(
      { side, entryPrice: input.entryPrice, stopLoss, volatility: input.volatility },
      this.config.takeProfit
    );
    const rrRatio = computeBlendedRiskReward(takeProfitTargets);

    const stats = this._tradeStatsBySymbol.get(input.symbol);
    const positionSize = computePositionSize(
      { equity, entryPrice: input.entryPrice, atr: input.atr, volatility: input.volatility, confidence: input.confidence, tradeStats: stats },
      this.config
    );

    const riskPerUnit = Math.abs(input.entryPrice - stopLoss) / input.entryPrice;
    const riskAmount = positionSize * riskPerUnit;

    const portfolioHeatPct = computePortfolioHeat({
      openPositions: this.exposureManager.getOpenPositions(),
      proposedRiskAmount: riskAmount,
      equity,
    });

    const exposureCheck = this.exposureManager.checkLimits(input.symbol, positionSize, equity);

    const { leverage } = computeAdjustedLeverage(
      {
        recommendedLeverage: input.recommendedLeverage,
        volatility: input.volatility,
        confidence: input.confidence,
        currentDrawdownPct: drawdownPct,
      },
      this.config.leverage
    );

    const riskState = {
      circuitBreakerTripped: this.circuitBreaker.isTripped(now),
      dailyTradeLimitExceeded: this.circuitBreaker.isDailyTradeLimitExceeded(now),
      dailyLossLimitExceeded: this.circuitBreaker.isDailyLossLimitExceeded(now),
      drawdownExceeded: this.drawdownManager.isDrawdownExceeded(),
      inCooldown: this.cooldownManager.isInCooldown(input.symbol, now),
      exposureCheck,
      rrRatio,
    };

    const validation = validateTrade(input, riskState, this.config.rejection);

    const riskScore = computeRiskScore(
      { volatility: input.volatility, confidence: input.confidence, portfolioHeatPct, drawdownPct, marketState: input.marketState },
      this.config
    );

    // "maxLoss" is the configured per-trade risk ceiling (policy limit),
    // not this specific trade's computed loss — that's `estimatedLoss`.
    // A trade's estimatedLoss should normally sit well under this ceiling;
    // if it doesn't, that is itself a signal worth surfacing to the caller.
    const maxLossPct = this.config.positionSizing.percentageOfEquity * 100;
    const estimatedLossPct = equity > 0 ? (riskAmount / equity) * 100 : 0;
    const finalTarget = takeProfitTargets[takeProfitTargets.length - 1];
    const estimatedProfitPct =
      equity > 0 && finalTarget
        ? (positionSize * (finalTarget.rMultiple * riskPerUnit) / equity) * 100
        : 0;

    const allowed = validation.allowed && positionSize > 0 && meetsMinimumRiskReward(rrRatio, this.config.takeProfit);
    const rejectReason = !validation.allowed
      ? validation.rejectReason
      : positionSize <= 0
        ? 'position_size_below_minimum'
        : !meetsMinimumRiskReward(rrRatio, this.config.takeProfit)
          ? 'risk_reward_below_minimum'
          : null;

    return {
      allowed,
      rejectReason,
      positionSize: allowed ? Math.round(positionSize * 100) / 100 : 0,
      leverage: allowed ? leverage : 0,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: takeProfitTargets.map((t) => Math.round(t.price * 100) / 100),
      takeProfitTargets,
      breakEven: this.config.stopLoss.breakEven.enabled,
      trailingStop: this.config.stopLoss.trailing.enabled,
      riskScore,
      portfolioHeat: Math.round(portfolioHeatPct * 100) / 100,
      maxLoss: Math.round(maxLossPct * 100) / 100,
      estimatedLoss: Math.round(estimatedLossPct * 100) / 100,
      estimatedProfit: Math.round(estimatedProfitPct * 100) / 100,
      rrRatio: Math.round(rrRatio * 100) / 100,
    };
  }

  /**
   * Recompute stop-loss management (break-even + trailing) for an
   * already-open position, given the current price and ATR. Called
   * periodically by the Execution Engine while a position is live.
   * @param {Object} input
   * @param {'LONG'|'SHORT'} input.side
   * @param {number} input.entryPrice
   * @param {number} input.currentPrice
   * @param {number} input.initialStopLoss
   * @param {number} input.currentStopLoss
   * @param {number} input.currentAtr
   * @returns {{stopLoss:number, movedToBreakEven:boolean, isTrailing:boolean}}
   */
  manageStopLoss(input) {
    const beResult = applyBreakEven(input, this.config.stopLoss.breakEven);
    const trailInput = { ...input, currentStopLoss: beResult.stopLoss };
    const trailResult = applyTrailingStop(trailInput, this.config.stopLoss.trailing);
    return {
      stopLoss: trailResult.stopLoss,
      movedToBreakEven: beResult.movedToBreakEven,
      isTrailing: trailResult.isTrailing,
    };
  }
}

export default RiskEngine;
