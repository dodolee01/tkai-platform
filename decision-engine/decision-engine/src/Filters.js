/**
 * TK AI Finance - Module 3: AI Decision Engine
 * Filters.js
 *
 * Post-processes the raw score into a set of rejections / confidence
 * adjustments / forced decisions. This is where "reject fake breakouts",
 * "reject low-volume moves", "reject conflicting indicators", "reject low
 * confidence trades", sideways detection, exhaustion detection and
 * continuation detection live.
 */

import { clamp, isFiniteNumber } from './Config.js';

function findSignal(signals, category, indicator) {
  return signals.find((s) => s.category === category && s.indicator === indicator) ?? null;
}

export class Filters {
  /**
   * @param {ReturnType<import('./Config.js').createConfig>} config
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {{
   *   marketStateResult: ReturnType<import('./MarketState.js').determineMarketState>,
   *   scoreResult: ReturnType<import('./ScoreCalculator.js').ScoreCalculator['calculate']>,
   *   trendResult: ReturnType<import('./TrendAnalyzer.js').TrendAnalyzer['analyze']>,
   *   momentumResult: ReturnType<import('./MomentumAnalyzer.js').MomentumAnalyzer['analyze']>,
   *   volatilityResult: ReturnType<import('./VolatilityAnalyzer.js').VolatilityAnalyzer['analyze']>,
   *   signalResult: ReturnType<import('./SignalEvaluator.js').SignalEvaluator['evaluate']>,
   *   snapshot: import('./types.js').MarketSnapshot,
   *   previousSnapshot: import('./types.js').MarketSnapshot|null,
   *   historyEntry: {decision?: string, state?: string}|null
   * }} params
   */
  apply({
    marketStateResult,
    scoreResult,
    trendResult,
    momentumResult,
    volatilityResult,
    signalResult,
    snapshot,
    historyEntry
  }) {
    const cfg = this.config.filters;
    const rejections = [];
    const notes = [];
    let confidenceAdjustment = 0;
    let forcedDecision = null;

    const { bullishWeight, bearishWeight } = scoreResult.participation;
    const totalDirectionalWeight = bullishWeight + bearishWeight;

    // --- Reject conflicting indicators -----------------------------------
    if (totalDirectionalWeight > 0) {
      const balanceRatio = Math.min(bullishWeight, bearishWeight) / Math.max(bullishWeight, bearishWeight, 0.0001);
      if (balanceRatio >= cfg.conflictRatioThreshold) {
        rejections.push('conflicting_indicators: bullish and bearish weight are nearly balanced');
        confidenceAdjustment -= cfg.conflictPenalty;
      }
    }

    // --- Reject low-volume moves -------------------------------------------
    if (cfg.minVolumeDeltaAbs > 0 && isFiniteNumber(snapshot.delta)) {
      if (Math.abs(snapshot.delta) < cfg.minVolumeDeltaAbs) {
        rejections.push('low_volume_move: order-flow delta below the configured minimum');
        confidenceAdjustment -= cfg.conflictPenalty / 2;
      }
    }

    // --- Reject fake breakouts ---------------------------------------------
    if (marketStateResult.state === 'BREAKOUT') {
      const oiSignal = findSignal(signalResult.orderflowSignals, 'orderflow', 'openInterest');
      const deltaSignal = findSignal(signalResult.orderflowSignals, 'orderflow', 'delta');
      const obSignal = findSignal(signalResult.orderflowSignals, 'orderflow', 'orderBook');

      const confirmations = [oiSignal, deltaSignal, obSignal].filter(
        (s) => s && s.signal === scoreResult.dominantDirection
      ).length;

      if (confirmations === 0) {
        rejections.push('fake_breakout_suspected: breakout lacks open-interest/delta/order-book confirmation');
        confidenceAdjustment -= cfg.fakeBreakoutPenalty;
        marketStateResult.state = 'RANGING';
        marketStateResult.reasons.push('Breakout downgraded to RANGING - no order-flow confirmation');
      } else {
        notes.push(`Breakout confirmed by ${confirmations} order-flow indicator(s)`);
      }
    }

    // --- Detect sideways markets --------------------------------------------
    if (marketStateResult.state === 'RANGING') {
      notes.push('Sideways market detected - directional trades suppressed in favor of WAIT');
      forcedDecision = 'WAIT';
    }

    // --- Detect trend exhaustion --------------------------------------------
    if (momentumResult.exhaustionRisk && (marketStateResult.state === 'TRENDING' || marketStateResult.state === 'REVERSAL')) {
      notes.push('Trend exhaustion detected via extreme RSI/Stochastic readings');
      confidenceAdjustment -= cfg.exhaustionPenalty;

      const heldDirection = historyEntry?.decision;
      if (heldDirection === 'LONG' || heldDirection === 'SHORT') {
        const exhaustionAgainstPosition =
          (heldDirection === 'LONG' && scoreResult.dominantDirection === 'BEARISH') ||
          (heldDirection === 'SHORT' && scoreResult.dominantDirection === 'BULLISH');
        if (exhaustionAgainstPosition) {
          forcedDecision = 'EXIT';
          notes.push(`Exhaustion is opposing the previously held ${heldDirection} bias - recommending EXIT`);
        }
      }
    }

    // --- Detect trend continuation (pullback into an intact trend) --------
    if (
      !forcedDecision &&
      trendResult.pullback &&
      trendResult.trendPresent &&
      trendResult.direction !== 'NEUTRAL' &&
      trendResult.direction === scoreResult.dominantDirection
    ) {
      notes.push('Pullback to EMA20 within an intact trend - continuation setup');
      confidenceAdjustment += cfg.continuationBonus;
    }

    // --- Reject low confidence trades --------------------------------------
    const adjustedConfidence = clamp(scoreResult.confidence + confidenceAdjustment, 0, 100);
    if (!forcedDecision && adjustedConfidence < this.config.decision.minConfidence) {
      rejections.push('low_confidence: adjusted confidence below the configured minimum');
      forcedDecision = 'WAIT';
    }

    return {
      rejections,
      notes,
      confidenceAdjustment,
      forcedDecision
    };
  }
}
