/**
 * @file Trend direction/strength detection over a numeric time
 * series (equity curve, price series, any metric history) via linear
 * regression, plus simple moving-average crossover detection.
 * @module analytics-engine/TrendAnalyzer
 */

import { linearRegression, mean } from './StatisticsEngine.js';

/**
 * @typedef {Object} TrendResult
 * @property {'up'|'down'|'flat'} direction
 * @property {number} strength - 0..1, the regression's R².
 * @property {number} slopePerPoint
 * @property {number} slopePct - Slope as a percentage of the series' mean value, for scale-independent comparison.
 */

/**
 * @param {number[]} values - Chronologically ordered.
 * @param {number} [flatThreshold=0.001] - |slopePct| below this is classified as 'flat'.
 * @returns {TrendResult}
 */
export function analyzeTrend(values, flatThreshold = 0.001) {
  if (values.length < 2) return { direction: 'flat', strength: 0, slopePerPoint: 0, slopePct: 0 };

  const indices = values.map((_, i) => i);
  const regression = linearRegression(indices, values);
  const avgValue = mean(values);
  const slopePct = avgValue === 0 ? 0 : regression.slope / Math.abs(avgValue);

  let direction = 'flat';
  if (Math.abs(slopePct) >= flatThreshold) direction = slopePct > 0 ? 'up' : 'down';

  return { direction, strength: Math.min(1, regression.rSquared), slopePerPoint: regression.slope, slopePct };
}

/**
 * Simple moving average.
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]} Same length as `values`; entries before the window fills are `null`.
 */
export function computeSMA(values, period) {
  const result = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    result.push(i >= period - 1 ? sum / period : null);
  }
  return result;
}

/**
 * Detect the most recent crossover event between a fast and slow SMA.
 * @param {number[]} values
 * @param {number} fastPeriod
 * @param {number} slowPeriod
 * @returns {'golden_cross'|'death_cross'|'none'} 'golden_cross' = fast crossed above slow; 'death_cross' = fast crossed below slow.
 */
export function detectCrossover(values, fastPeriod, slowPeriod) {
  const fast = computeSMA(values, fastPeriod);
  const slow = computeSMA(values, slowPeriod);
  for (let i = fast.length - 1; i > 0; i--) {
    if (fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) continue;
    const wasBelow = fast[i - 1] <= slow[i - 1];
    const isAbove = fast[i] > slow[i];
    if (wasBelow && isAbove) return 'golden_cross';
    const wasAbove = fast[i - 1] >= slow[i - 1];
    const isBelow = fast[i] < slow[i];
    if (wasAbove && isBelow) return 'death_cross';
    // No transition at this step — keep scanning backward for the most recent actual crossover.
  }
  return 'none';
}

export default { analyzeTrend, computeSMA, detectCrossover };
