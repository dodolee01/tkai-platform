/**
 * TK AI Finance - Module 3: AI Decision Engine
 * Weights.js
 *
 * Every indicator that can contribute to the final score has a configurable
 * weight here, grouped by category. ScoreCalculator normalizes by the sum of
 * weights that were actually available in a given snapshot, so missing
 * indicators never skew the -100..100 scale.
 */

import { deepMerge } from './Config.js';

/** @type {const} */
export const DEFAULT_WEIGHTS = {
  trend: {
    emaAlignment: 12,
    adx: 8,
    supertrend: 9,
    ichimoku: 8,
    vwap: 5,
    pivot: 4
  },
  momentum: {
    rsi: 7,
    macd: 9,
    stochastic: 5,
    mfi: 4,
    cci: 4,
    williamsR: 3
  },
  volatility: {
    atr: 3,
    bollinger: 3
  },
  orderflow: {
    funding: 6,
    openInterest: 6,
    orderBook: 6,
    delta: 6,
    volumeProfile: 5,
    obv: 3,
    cmf: 3
  }
};

/**
 * @param {Partial<typeof DEFAULT_WEIGHTS>} [overrides]
 * @returns {typeof DEFAULT_WEIGHTS}
 */
export function createWeights(overrides = {}) {
  return deepMerge(DEFAULT_WEIGHTS, overrides);
}

/**
 * Flattens the category/indicator weight tree into a single lookup of
 * `"category.indicator" -> weight`.
 *
 * @param {typeof DEFAULT_WEIGHTS} weights
 * @returns {Record<string, number>}
 */
export function flattenWeights(weights) {
  /** @type {Record<string, number>} */
  const flat = {};
  for (const category of Object.keys(weights)) {
    for (const indicator of Object.keys(weights[category])) {
      flat[`${category}.${indicator}`] = weights[category][indicator];
    }
  }
  return flat;
}

/**
 * @param {typeof DEFAULT_WEIGHTS} weights
 * @returns {number}
 */
export function totalWeight(weights) {
  return Object.values(flattenWeights(weights)).reduce((sum, w) => sum + w, 0);
}
