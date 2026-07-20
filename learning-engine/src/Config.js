/**
 * @file Central, fully-overridable configuration for the learning engine.
 * @module learning-engine/Config
 */

/**
 * The seven market regimes this module learns independently for.
 * @type {string[]}
 */
export const MARKET_REGIMES = Object.freeze([
  'TRENDING',
  'RANGING',
  'BREAKOUT',
  'REVERSAL',
  'HIGH_VOLATILITY',
  'LOW_VOLATILITY',
  'NEWS_RISK',
]);

/**
 * @type {object}
 */
export const DEFAULT_CONFIG = Object.freeze({
  weightOptimizer: Object.freeze({
    minSampleSize: 15, // below this many observations, an indicator's weight is not adjusted
    learningRate: 0.05, // max fractional step per optimization cycle (never overreact)
    decayFactor: 0.02, // small pull back toward the 1.0 baseline each cycle, regularizing extreme weights
    minWeight: 0.2,
    maxWeight: 2.5,
    baselineWeight: 1.0,
  }),
  confidenceOptimizer: Object.freeze({
    numBuckets: 10, // confidence deciles: [0,0.1), [0.1,0.2), ... [0.9,1.0]
    minBucketSampleSize: 10,
    smoothingFactor: 0.3, // blends raw actual-win-rate signal with the baseline (identity) calibration, damping small-sample noise
  }),
  overfitting: Object.freeze({
    minReliableSampleSize: 30, // stats below this are flagged as small-sample-biased
    recentWindowSize: 20, // "recent" window for spike/degradation comparisons
    spikeMultiplierThreshold: 1.8, // recent expectancy > this x historical => suspicious spike
    degradationThreshold: 0.5, // recent expectancy < this x historical => degradation
    maxParametersAdjustedRatio: 0.5, // if > 50% of tracked indicators got adjusted this cycle relative to sample size, flag
    confidenceInflationThreshold: 0.15, // avg predicted confidence - actual win rate > this => inflation
  }),
  marketRegimes: MARKET_REGIMES,
  performance: Object.freeze({
    riskFreeRatePerTrade: 0, // expressed in the same units as pnlPercent
    annualizationFactor: 252, // trading-days-style annualization for Sharpe/Sortino when a trades-per-year estimate isn't available
  }),
  learningScore: Object.freeze({
    weights: Object.freeze({
      sampleSufficiency: 0.25,
      calibrationQuality: 0.25,
      overfittingPenalty: 0.3,
      expectancyHealth: 0.2,
    }),
  }),
  recommendation: Object.freeze({
    underperformingExpectancyThreshold: 0, // indicators/strategies/regimes with expectancy at or below this are flagged
    strongUnderperformingWinRateThreshold: 0.35,
  }),
  strategy: Object.freeze({
    // Default strategy-key extractor: see StrategyStatistics.js. Callers
    // may supply their own via LearningEngine construction options.
    defaultKeyFields: Object.freeze(['decision', 'timeframe']),
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
 * Deep-merge a partial configuration over {@link DEFAULT_CONFIG}.
 * @param {object} [overrides={}]
 * @returns {object}
 */
export function createConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
}

export default { DEFAULT_CONFIG, createConfig, MARKET_REGIMES };
