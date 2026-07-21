/**
 * @file Portfolio-composition analytics over a duck-typed portfolio
 * snapshot: allocation by asset/sector/exchange/strategy, capital
 * utilization, and exposure distribution shape (concentration).
 * @module analytics-engine/PortfolioAnalytics
 */

/**
 * Herfindahl-Hirschman Index style concentration measure: sum of
 * squared allocation fractions. 1/n for n equally-weighted
 * allocations (perfectly diversified among n), 1.0 for total
 * concentration in one bucket.
 * @param {Object.<string, number>} allocation - fractions (0..1) keyed by bucket.
 * @returns {number}
 */
export function computeConcentrationIndex(allocation) {
  const values = Object.values(allocation);
  if (values.length === 0) return 0;
  return values.reduce((a, v) => a + v * v, 0);
}

/**
 * @typedef {Object} PortfolioAnalyticsReport
 * @property {Object.<string, number>} assetAllocation
 * @property {Object.<string, number>} sectorAllocation
 * @property {Object.<string, number>} exchangeAllocation
 * @property {Object.<string, number>} strategyAllocation
 * @property {number} capitalUtilizationPct - usedMargin / equity.
 * @property {number} assetConcentrationIndex
 * @property {number} strategyConcentrationIndex
 * @property {number} largestAssetAllocationPct
 */

/**
 * @param {import('./types.js').PortfolioSnapshot} snapshot
 * @returns {PortfolioAnalyticsReport}
 */
export function computePortfolioAnalytics(snapshot) {
  const assetAllocation = snapshot.assetExposure ?? {};
  const sectorAllocation = snapshot.sectorExposure ?? {};
  const exchangeAllocation = snapshot.exchangeExposure ?? {};
  const strategyAllocation = snapshot.strategyExposure ?? {};

  const capitalUtilizationPct = snapshot.equity > 0 ? (snapshot.usedMargin / snapshot.equity) * 100 : 0;
  const assetValues = Object.values(assetAllocation);
  const largestAssetAllocationPct = assetValues.length === 0 ? 0 : Math.max(...assetValues) * 100;

  return {
    assetAllocation,
    sectorAllocation,
    exchangeAllocation,
    strategyAllocation,
    capitalUtilizationPct,
    assetConcentrationIndex: computeConcentrationIndex(assetAllocation),
    strategyConcentrationIndex: computeConcentrationIndex(strategyAllocation),
    largestAssetAllocationPct,
  };
}

export default { computeConcentrationIndex, computePortfolioAnalytics };
