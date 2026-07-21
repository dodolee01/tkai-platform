/**
 * @file Market-condition analytics over duck-typed market snapshots
 * (Module 1/2 shapes): volatility, regime classification, trend
 * strength, liquidity, volume profile, market breadth, and
 * funding/open-interest statistics.
 * @module analytics-engine/MarketAnalytics
 */

import { mean, stdDev, linearRegression } from './StatisticsEngine.js';

/**
 * @param {string} marketState
 * @param {number} volatility
 * @param {object} config - `config.market` section.
 * @returns {'trending'|'ranging'|'high_volatility'|'low_volatility'}
 * @private
 */
function classifyRegime(volatility, trendStrength, config) {
  if (volatility >= config.highVolatilityThreshold) return 'high_volatility';
  if (volatility <= config.lowVolatilityThreshold && trendStrength < config.trendStrengthThreshold) return 'low_volatility';
  return trendStrength >= config.trendStrengthThreshold ? 'trending' : 'ranging';
}

/**
 * @typedef {Object} MarketAnalyticsReport
 * @property {number} averageVolatility
 * @property {string} regime
 * @property {number} trendStrength - 0..1, derived from the R² of a linear regression on price over the snapshot window.
 * @property {number} liquidityScore - 0..100, derived from average volume relative to its own history (higher = more liquid than usual).
 * @property {number} marketBreadthPct - % of symbols with a positive priceChangePct.
 * @property {number} averageFundingRate
 * @property {number} averageOpenInterest
 * @property {number} openInterestChangePct
 */

/**
 * @param {import('./types.js').MarketSnapshot[]} snapshots - Chronologically ordered, ideally for one symbol (or a comparable basket).
 * @param {object} config - `config.market` section.
 * @returns {MarketAnalyticsReport}
 */
export function computeMarketAnalytics(snapshots, config) {
  if (snapshots.length === 0) {
    return { averageVolatility: 0, regime: 'ranging', trendStrength: 0, liquidityScore: 0, marketBreadthPct: 0, averageFundingRate: 0, averageOpenInterest: 0, openInterestChangePct: 0 };
  }

  const volatilities = snapshots.map((s) => s.volatility);
  const averageVolatility = mean(volatilities);

  const prices = snapshots.map((s) => s.price);
  const indices = prices.map((_, i) => i);
  const regression = linearRegression(indices, prices);
  const trendStrength = Math.min(1, regression.rSquared);

  const regime = classifyRegime(averageVolatility, trendStrength, config);

  const volumes = snapshots.map((s) => s.volume);
  const avgVolume = mean(volumes);
  const volumeSd = stdDev(volumes);
  const latestVolume = volumes[volumes.length - 1];
  const liquidityScore = volumeSd === 0 ? 50 : Math.min(100, Math.max(0, 50 + ((latestVolume - avgVolume) / volumeSd) * 15));

  const advancing = snapshots.filter((s) => s.priceChangePct > 0).length;
  const marketBreadthPct = (advancing / snapshots.length) * 100;

  const fundingRates = snapshots.map((s) => s.fundingRate).filter((r) => r !== undefined);
  const averageFundingRate = fundingRates.length === 0 ? 0 : mean(fundingRates);

  const ois = snapshots.map((s) => s.openInterest).filter((oi) => oi !== undefined);
  const averageOpenInterest = ois.length === 0 ? 0 : mean(ois);
  const openInterestChangePct = ois.length < 2 || ois[0] === 0 ? 0 : ((ois[ois.length - 1] - ois[0]) / ois[0]) * 100;

  return { averageVolatility, regime, trendStrength, liquidityScore, marketBreadthPct, averageFundingRate, averageOpenInterest, openInterestChangePct };
}

export default { computeMarketAnalytics };
