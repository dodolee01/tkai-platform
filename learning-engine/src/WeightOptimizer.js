/**
 * @file Deterministic indicator-weight optimization. Increases
 * weights for indicators that consistently improve outcomes,
 * decreases weights for ones that don't — bounded per-cycle step size
 * and a small pull-back toward the neutral baseline so the system
 * never overreacts to a handful of trades.
 * @module learning-engine/WeightOptimizer
 */

/**
 * @typedef {Object} WeightAdjustment
 * @property {string} indicator
 * @property {number} previousWeight
 * @property {number} newWeight
 * @property {number} delta
 * @property {boolean} adjusted - False if the indicator was skipped (insufficient sample size).
 */

/**
 * Compute updated weights from current indicator performance.
 * For each indicator with `appearances >= minSampleSize`, nudges the
 * weight toward higher/lower based on the sign and magnitude of its
 * expectancy, capped at `learningRate` per cycle, then applies a
 * small `decayFactor` pull toward `baselineWeight` (regularization
 * against runaway extreme weights). Indicators below the sample-size
 * threshold are left untouched.
 * @param {import('./types.js').IndicatorPerformance[]} indicatorPerformance
 * @param {Object.<string, number>} previousWeights - indicator name -> current weight.
 * @param {object} config - `config.weightOptimizer` section.
 * @returns {{updatedWeights: Object.<string, number>, adjustments: WeightAdjustment[]}}
 */
export function optimizeWeights(indicatorPerformance, previousWeights, config) {
  const updatedWeights = { ...previousWeights };
  const adjustments = [];

  for (const perf of indicatorPerformance) {
    const previousWeight = previousWeights[perf.indicator] ?? config.baselineWeight;

    if (perf.appearances < config.minSampleSize) {
      adjustments.push({ indicator: perf.indicator, previousWeight, newWeight: previousWeight, delta: 0, adjusted: false });
      continue;
    }

    // Normalize expectancy into a direction signal in [-1, 1] via tanh,
    // so a handful of very large winners/losers can't dominate the step.
    const signal = Math.tanh(perf.expectancy * 20);
    const step = signal * config.learningRate;

    let candidate = previousWeight * (1 + step);

    // Regularization: pull a small fraction of the way back toward baseline.
    candidate = candidate + (config.baselineWeight - candidate) * config.decayFactor;

    const newWeight = Math.min(Math.max(candidate, config.minWeight), config.maxWeight);
    updatedWeights[perf.indicator] = newWeight;
    adjustments.push({
      indicator: perf.indicator,
      previousWeight,
      newWeight,
      delta: newWeight - previousWeight,
      adjusted: true,
    });
  }

  return { updatedWeights, adjustments };
}

export default { optimizeWeights };
