/**
 * @file Central, fully-overridable configuration for the analytics engine.
 * @module analytics-engine/Config
 */

export const DEFAULT_CONFIG = Object.freeze({
  performance: Object.freeze({
    riskFreeRatePerTrade: 0,
    annualizationFactor: 252,
    omegaThreshold: 0, // return threshold separating "gains" from "losses" for the Omega ratio
  }),
  forecast: Object.freeze({
    horizonDays: 30,
    confidenceLevel: 0.95, // for forecast bands (z = 1.96 at 95%)
    minHistoryPoints: 10,
  }),
  heatmap: Object.freeze({
    hourBuckets: 24,
    dayBuckets: 7,
  }),
  benchmark: Object.freeze({
    defaultSymbols: Object.freeze(['BTC', 'ETH', 'SP500', 'NASDAQ']),
  }),
  strategy: Object.freeze({
    minTradesForRanking: 5,
    rankingWeights: Object.freeze({ sharpe: 0.4, profitFactor: 0.3, winRate: 0.3 }),
  }),
  market: Object.freeze({
    highVolatilityThreshold: 0.04,
    lowVolatilityThreshold: 0.01,
    trendStrengthThreshold: 0.6,
  }),
  export: Object.freeze({
    csvDelimiter: ',',
  }),
  repository: Object.freeze({
    batchSize: 5000, // page size used when streaming millions of historical trades from a repository
  }),
});

/**
 * @param {object} base
 * @param {object} patch
 * @returns {object}
 * @private
 */
function deepMerge(base, patch) {
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    const baseValue = base[key];
    if (
      patchValue &&
      typeof patchValue === 'object' &&
      !Array.isArray(patchValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      base[key] = deepMerge({ ...baseValue }, patchValue);
    } else {
      base[key] = patchValue;
    }
  }
  return base;
}

/**
 * @param {object} [overrides={}]
 * @returns {object}
 */
export function createConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
}

export default { DEFAULT_CONFIG, createConfig };
