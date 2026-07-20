/**
 * @file Composite 0-100 risk score, blending volatility, confidence,
 * portfolio heat, drawdown, and market-state danger into one number.
 * Higher = riskier.
 * @module risk-engine/RiskScore
 */

/**
 * Normalize volatility (fractional, unbounded above) onto 0-100,
 * where `referenceVolatility` maps to 50 and scales roughly linearly
 * beyond that, capped at 100.
 * @param {number} volatility
 * @param {number} [referenceVolatility=0.04]
 * @returns {number}
 * @private
 */
function normalizeVolatility(volatility, referenceVolatility = 0.04) {
  const ratio = volatility / referenceVolatility;
  return Math.min(100, ratio * 50);
}

/**
 * Confidence (0..1, higher = safer) inverted onto a 0-100 risk scale.
 * @param {number} confidence
 * @returns {number}
 * @private
 */
function normalizeConfidenceRisk(confidence) {
  return Math.min(100, Math.max(0, (1 - confidence) * 100));
}

/**
 * Portfolio heat (already a percentage) clamped onto 0-100.
 * @param {number} heatPct
 * @returns {number}
 * @private
 */
function normalizeHeat(heatPct) {
  return Math.min(100, Math.max(0, heatPct));
}

/**
 * Drawdown fraction (0..1+) onto a 0-100 risk scale, where the
 * configured max-drawdown threshold maps to 100.
 * @param {number} drawdownPct
 * @param {number} maxDrawdownPct
 * @returns {number}
 * @private
 */
function normalizeDrawdown(drawdownPct, maxDrawdownPct) {
  if (maxDrawdownPct <= 0) return 0;
  return Math.min(100, (drawdownPct / maxDrawdownPct) * 100);
}

/**
 * Market state danger onto 0-100 (100 if the market state is in the
 * configured dangerous-states list, else 0).
 * @param {string} marketState
 * @param {string[]} dangerousStates
 * @returns {number}
 * @private
 */
function normalizeMarketState(marketState, dangerousStates) {
  return dangerousStates.includes(marketState) ? 100 : 0;
}

/**
 * Compute the composite 0-100 risk score.
 * @param {Object} input
 * @param {number} input.volatility
 * @param {number} input.confidence
 * @param {number} input.portfolioHeatPct
 * @param {number} input.drawdownPct
 * @param {string} input.marketState
 * @param {object} config - `config.riskScore` and `config.drawdown` sections.
 * @param {object} config.riskScore
 * @param {object} config.drawdown
 * @returns {number} 0-100 composite risk score.
 */
export function computeRiskScore(
  { volatility, confidence, portfolioHeatPct, drawdownPct, marketState },
  config
) {
  const { weights, dangerousMarketStates } = config.riskScore;

  const components = {
    volatility: normalizeVolatility(volatility),
    confidence: normalizeConfidenceRisk(confidence),
    portfolioHeat: normalizeHeat(portfolioHeatPct),
    drawdown: normalizeDrawdown(drawdownPct, config.drawdown.maxDrawdownPct),
    marketState: normalizeMarketState(marketState, dangerousMarketStates),
  };

  const score =
    components.volatility * weights.volatility +
    components.confidence * weights.confidence +
    components.portfolioHeat * weights.portfolioHeat +
    components.drawdown * weights.drawdown +
    components.marketState * weights.marketState;

  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100;
}

export default { computeRiskScore };
