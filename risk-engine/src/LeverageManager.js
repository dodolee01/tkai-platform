/**
 * @file Leverage adjustment: reduces (never increases) the Decision
 * Engine's recommended leverage based on volatility, confidence, and
 * current drawdown state.
 * @module risk-engine/LeverageManager
 */

/**
 * Compute the final leverage to use for a trade. This module never
 * increases leverage beyond what the Decision Engine recommended —
 * it only applies risk-driven reductions, then clamps to
 * `[minLeverage, maxLeverage]`.
 * @param {Object} input
 * @param {number} input.recommendedLeverage
 * @param {number} input.volatility - Fractional volatility.
 * @param {number} input.confidence - 0..1
 * @param {number} input.currentDrawdownPct - Current drawdown as a fraction (e.g. 0.12 = 12%).
 * @param {object} config - `config.leverage` section.
 * @returns {{leverage:number, reductions:string[]}}
 */
export function computeAdjustedLeverage(
  { recommendedLeverage, volatility, confidence, currentDrawdownPct },
  config
) {
  let leverage = recommendedLeverage;
  const reductions = [];

  if (volatility >= config.highVolatilityThreshold) {
    leverage *= config.highVolatilityReductionFactor;
    reductions.push('high_volatility');
  }

  if (confidence < config.lowConfidenceThreshold) {
    leverage *= config.lowConfidenceReductionFactor;
    reductions.push('low_confidence');
  }

  if (currentDrawdownPct >= config.drawdownReductionThreshold) {
    leverage *= config.drawdownReductionFactor;
    reductions.push('drawdown_protection');
  }

  leverage = Math.min(Math.max(leverage, config.minLeverage), config.maxLeverage);
  leverage = Math.min(leverage, recommendedLeverage); // hard rule: never exceed the Decision Engine's recommendation

  return { leverage: Math.round(leverage * 100) / 100, reductions };
}

export default { computeAdjustedLeverage };
