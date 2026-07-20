/**
 * TK AI Finance - Module 3: AI Decision Engine
 * DecisionEngine.js
 *
 * Orchestrates TrendAnalyzer, MomentumAnalyzer, VolatilityAnalyzer,
 * MarketState, SignalEvaluator, ScoreCalculator and Filters into a single
 * LONG / SHORT / WAIT / EXIT decision for a market snapshot produced by
 * Module 1. This module never calculates indicators itself - it only
 * consumes and interprets the snapshot it is given.
 *
 * The engine keeps a small, bounded in-memory history per symbol/timeframe
 * so it can reason about momentum slope (RSI/OBV rising or falling),
 * open-interest deltas and whether a previously issued LONG/SHORT call
 * should now be exited on a reversal - all without ever recomputing an
 * indicator.
 */

import { createConfig, clamp, roundTo, isFiniteNumber } from './Config.js';
import { createWeights } from './Weights.js';
import { TrendAnalyzer } from './TrendAnalyzer.js';
import { MomentumAnalyzer } from './MomentumAnalyzer.js';
import { VolatilityAnalyzer } from './VolatilityAnalyzer.js';
import { determineMarketState } from './MarketState.js';
import { SignalEvaluator } from './SignalEvaluator.js';
import { ScoreCalculator } from './ScoreCalculator.js';
import { Filters } from './Filters.js';

/**
 * @param {import('./types.js').MarketSnapshot} snapshot
 */
function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('DecisionEngine.evaluate() requires a market snapshot object');
  }
  if (typeof snapshot.symbol !== 'string' || snapshot.symbol.length === 0) {
    throw new TypeError('MarketSnapshot.symbol must be a non-empty string');
  }
  if (typeof snapshot.timeframe !== 'string' || snapshot.timeframe.length === 0) {
    throw new TypeError('MarketSnapshot.timeframe must be a non-empty string');
  }
  if (!isFiniteNumber(snapshot.price) || snapshot.price <= 0) {
    throw new TypeError('MarketSnapshot.price must be a positive finite number');
  }
}

/**
 * Bounded per-key history so the engine can reference the previous
 * snapshot and the previously issued decision without unbounded growth.
 */
class SnapshotHistory {
  /**
   * @param {number} maxEntriesPerKey
   */
  constructor(maxEntriesPerKey) {
    this.maxEntriesPerKey = maxEntriesPerKey;
    /** @type {Map<string, Array<{snapshot: import('./types.js').MarketSnapshot, decision: string, state: string, evaluatedAt: number}>>} */
    this.store = new Map();
  }

  key(symbol, timeframe) {
    return `${symbol}::${timeframe}`;
  }

  latest(symbol, timeframe) {
    const entries = this.store.get(this.key(symbol, timeframe));
    return entries && entries.length > 0 ? entries[entries.length - 1] : null;
  }

  record(symbol, timeframe, entry) {
    const k = this.key(symbol, timeframe);
    const entries = this.store.get(k) ?? [];
    entries.push(entry);
    while (entries.length > this.maxEntriesPerKey) entries.shift();
    this.store.set(k, entries);
  }

  reset(symbol, timeframe) {
    if (symbol === undefined) {
      this.store.clear();
      return;
    }
    if (timeframe === undefined) {
      for (const k of [...this.store.keys()]) {
        if (k.startsWith(`${symbol}::`)) this.store.delete(k);
      }
      return;
    }
    this.store.delete(this.key(symbol, timeframe));
  }
}

export class DecisionEngine {
  /**
   * @param {Partial<import('./Config.js').DEFAULT_CONFIG>} [configOverrides]
   * @param {Partial<import('./Weights.js').DEFAULT_WEIGHTS>} [weightOverrides]
   */
  constructor(configOverrides = {}, weightOverrides = {}) {
    this.config = createConfig(configOverrides);
    this.weights = createWeights(weightOverrides);

    this.trendAnalyzer = new TrendAnalyzer(this.config);
    this.momentumAnalyzer = new MomentumAnalyzer(this.config);
    this.volatilityAnalyzer = new VolatilityAnalyzer(this.config);
    this.signalEvaluator = new SignalEvaluator(this.config, this.weights);
    this.scoreCalculator = new ScoreCalculator(this.weights, this.config);
    this.filters = new Filters(this.config);

    this.history = new SnapshotHistory(this.config.history.maxSnapshotsPerKey);
  }

  /**
   * @param {'LOW'|'MEDIUM'|'HIGH'} volatilityLevel
   * @param {number} confidence
   */
  computeRiskLevel(volatilityLevel, confidence) {
    const floor = this.config.risk.riskLevelConfidenceFloor;
    if (volatilityLevel === 'HIGH' || confidence < floor.MEDIUM) return 'HIGH';
    if (volatilityLevel === 'MEDIUM' || confidence < floor.LOW) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * @param {'LONG'|'SHORT'|'WAIT'|'EXIT'} decision
   * @param {'LOW'|'MEDIUM'|'HIGH'} riskLevel
   * @param {number} confidence
   */
  computeRecommendation(decision, riskLevel, confidence) {
    if (decision === 'WAIT' || decision === 'EXIT') {
      return { recommendedLeverage: 1, recommendedRisk: 0 };
    }

    const baseLeverage = this.config.risk.leverageByRisk[riskLevel] ?? 1;
    const confidenceFactor = 0.5 + confidence / 200; // 0.5 .. 1.0
    const recommendedLeverage = clamp(
      Math.round(baseLeverage * confidenceFactor),
      1,
      this.config.risk.maxLeverage
    );

    const riskLevelMultiplier = riskLevel === 'LOW' ? 1 : riskLevel === 'MEDIUM' ? 0.66 : 0.4;
    const recommendedRisk = clamp(
      roundTo(this.config.risk.baseRiskPercent * (confidence / 100) * riskLevelMultiplier, 2),
      0,
      this.config.risk.maxRiskPercent
    );

    return { recommendedLeverage, recommendedRisk };
  }

  /**
   * @param {import('./types.js').MarketSnapshot} snapshot
   * @returns {import('./types.js').DecisionResult}
   */
  evaluate(snapshot) {
    validateSnapshot(snapshot);

    const historyEntry = this.history.latest(snapshot.symbol, snapshot.timeframe);
    const previousSnapshot = historyEntry?.snapshot ?? null;

    const trendResult = this.trendAnalyzer.analyze(snapshot, previousSnapshot);
    const momentumResult = this.momentumAnalyzer.analyze(snapshot, previousSnapshot);
    const volatilityResult = this.volatilityAnalyzer.analyze(snapshot, previousSnapshot);

    const marketStateResult = determineMarketState({
      snapshot,
      trendResult,
      momentumResult,
      volatilityResult,
      config: this.config
    });

    const signalResult = this.signalEvaluator.evaluate({
      snapshot,
      previousSnapshot,
      trendResult,
      momentumResult,
      volatilityResult
    });

    const scoreResult = this.scoreCalculator.calculate(signalResult.signals);

    const filterResult = this.filters.apply({
      marketStateResult,
      scoreResult,
      trendResult,
      momentumResult,
      volatilityResult,
      signalResult,
      snapshot,
      previousSnapshot,
      historyEntry
    });

    let decision;
    if (filterResult.forcedDecision) {
      decision = filterResult.forcedDecision;
    } else if (scoreResult.totalScore >= this.config.decision.longThreshold) {
      decision = 'LONG';
    } else if (scoreResult.totalScore <= this.config.decision.shortThreshold) {
      decision = 'SHORT';
    } else {
      decision = 'WAIT';
    }

    // Reversal-driven exit: an open directional call flips to EXIT when the
    // market swings strongly against it, independent of the filter's own
    // exhaustion-based exit check above.
    if (
      decision !== 'EXIT' &&
      !filterResult.forcedDecision &&
      (historyEntry?.decision === 'LONG' || historyEntry?.decision === 'SHORT')
    ) {
      const reversalConfirmed =
        marketStateResult.state === 'REVERSAL' ||
        (historyEntry.decision === 'LONG' && scoreResult.totalScore <= -this.config.decision.exitReversalThreshold) ||
        (historyEntry.decision === 'SHORT' && scoreResult.totalScore >= this.config.decision.exitReversalThreshold);

      if (reversalConfirmed) {
        decision = 'EXIT';
        filterResult.notes.push(`Reversal against the previously held ${historyEntry.decision} call - recommending EXIT`);
      }
    }

    const confidence = clamp(
      roundTo(scoreResult.confidence + filterResult.confidenceAdjustment, 1),
      0,
      100
    );

    const riskLevel = this.computeRiskLevel(volatilityResult.level, confidence);
    const { recommendedLeverage, recommendedRisk } = this.computeRecommendation(decision, riskLevel, confidence);

    const reasons = [
      ...marketStateResult.reasons,
      ...filterResult.notes,
      ...filterResult.rejections
    ];

    /** @type {import('./types.js').DecisionResult} */
    const result = {
      decision,
      confidence,
      marketState: marketStateResult.state,
      trendStrength: trendResult.strength,
      volatility: volatilityResult.level,
      riskLevel,
      recommendedLeverage,
      recommendedRisk,
      bullishSignals: signalResult.bullishSignals,
      bearishSignals: signalResult.bearishSignals,
      scoreBreakdown: scoreResult.scoreBreakdown,
      reasons
    };

    this.history.record(snapshot.symbol, snapshot.timeframe, {
      snapshot,
      decision,
      state: marketStateResult.state,
      evaluatedAt: Date.now()
    });

    return result;
  }

  /**
   * Clears retained history. Call with no arguments to reset everything,
   * with only `symbol` to reset every timeframe for that symbol, or with
   * both to reset a single symbol/timeframe pair.
   *
   * @param {string} [symbol]
   * @param {string} [timeframe]
   */
  resetHistory(symbol, timeframe) {
    this.history.reset(symbol, timeframe);
  }
}
