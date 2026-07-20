/**
 * @file Multi-target take-profit calculation, dynamic (volatility-aware)
 * target widening, and risk:reward validation.
 * @module risk-engine/TakeProfit
 */

import { stopDistance } from './StopLoss.js';

/**
 * Compute multi-target take-profit prices from the configured
 * R-multiple targets, optionally widened when volatility is high.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.stopLoss
 * @param {number} input.volatility - Fractional volatility (e.g. ATR/price).
 * @param {object} config - `config.takeProfit` section.
 * @returns {import('./types.js').TakeProfitTarget[]}
 */
export function computeTakeProfitTargets({ side, entryPrice, stopLoss, volatility }, config) {
  const risk = stopDistance(side, entryPrice, stopLoss);
  if (risk <= 0) return [];

  const expand =
    config.volatilityExpansion.enabled && volatility >= config.volatilityExpansion.highVolatilityThreshold;
  const factor = expand ? config.volatilityExpansion.expansionFactor : 1;

  return config.targets.map((target) => {
    const effectiveRMultiple = target.rMultiple * factor;
    const distance = risk * effectiveRMultiple;
    const price = side === 'LONG' ? entryPrice + distance : entryPrice - distance;
    return { price, sizePct: target.sizePct, rMultiple: effectiveRMultiple };
  });
}

/**
 * Compute the size-weighted blended R-multiple across all targets —
 * the effective risk:reward ratio for the trade as a whole.
 * @param {import('./types.js').TakeProfitTarget[]} targets
 * @returns {number}
 */
export function computeBlendedRiskReward(targets) {
  if (targets.length === 0) return 0;
  const totalSizePct = targets.reduce((a, t) => a + t.sizePct, 0);
  if (totalSizePct === 0) return 0;
  const weightedR = targets.reduce((a, t) => a + t.rMultiple * t.sizePct, 0);
  return weightedR / totalSizePct;
}

/**
 * Validate that a trade's risk:reward ratio meets the configured minimum.
 * @param {number} rrRatio
 * @param {object} config - `config.takeProfit` section (uses `minRiskReward`).
 * @returns {boolean}
 */
export function meetsMinimumRiskReward(rrRatio, config) {
  return rrRatio >= config.minRiskReward;
}

export default { computeTakeProfitTargets, computeBlendedRiskReward, meetsMinimumRiskReward };
