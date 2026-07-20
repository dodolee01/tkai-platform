/**
 * @file Kelly Criterion position-sizing math.
 * @module risk-engine/KellyCriterion
 */

/**
 * @typedef {Object} TradeStats
 * @property {number} winRate - Fraction of winning trades, 0..1.
 * @property {number} avgWinPct - Average winning trade size as a fraction of risk (e.g. 1.8 = wins average 1.8R).
 * @property {number} avgLossPct - Average losing trade size as a fraction of risk, expressed positive (e.g. 1.0 = losses average 1R).
 * @property {number} sampleSize - Number of historical trades this statistic is based on.
 */

/**
 * Compute the raw Kelly fraction: f* = W - (1 - W) / R
 * where W is win rate and R is the win/loss payoff ratio (avgWin / avgLoss).
 * @param {TradeStats} stats
 * @returns {number} Raw Kelly fraction. Can be negative (meaning: don't bet) or > 1 (meaning: the edge is very large — callers must still clamp).
 */
export function computeRawKellyFraction({ winRate, avgWinPct, avgLossPct }) {
  if (avgLossPct <= 0) {
    throw new Error('KellyCriterion: avgLossPct must be a positive number');
  }
  const payoffRatio = avgWinPct / avgLossPct;
  return winRate - (1 - winRate) / payoffRatio;
}

/**
 * Compute a safe, fractional ("half-Kelly" style) position size fraction
 * of equity, applying the configured Kelly multiplier and a hard cap.
 * Falls back to 0 (meaning: caller should use a non-Kelly sizing method)
 * when the raw Kelly fraction is non-positive, or when there isn't yet
 * enough trade history to trust the statistic.
 * @param {TradeStats} stats
 * @param {Object} config - `config.kelly` section of the risk engine config.
 * @param {number} config.kellyFractionMultiplier
 * @param {number} config.maxKellyFraction
 * @param {number} config.minSampleTrades
 * @returns {{fraction:number, usable:boolean, rawFraction:number}}
 */
export function computeKellyPositionFraction(stats, config) {
  if (stats.sampleSize < config.minSampleTrades) {
    return { fraction: 0, usable: false, rawFraction: 0 };
  }
  const rawFraction = computeRawKellyFraction(stats);
  if (rawFraction <= 0) {
    return { fraction: 0, usable: false, rawFraction };
  }
  const scaled = rawFraction * config.kellyFractionMultiplier;
  const fraction = Math.min(scaled, config.maxKellyFraction);
  return { fraction, usable: true, rawFraction };
}

export default { computeRawKellyFraction, computeKellyPositionFraction };
