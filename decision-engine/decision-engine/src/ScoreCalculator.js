/**
 * TK AI Finance - Module 3: AI Decision Engine
 * ScoreCalculator.js
 *
 * Turns the flat list of per-indicator signals (each with a direction,
 * strength 0..1 and configurable weight from Weights.js) into a single
 * -100..100 score, a per-category breakdown, and a confidence value that
 * rewards both conviction (score magnitude) and cross-indicator agreement.
 */

import { clamp, roundTo, safeDivide } from './Config.js';

const CATEGORIES = ['trend', 'momentum', 'volatility', 'orderflow'];

export class ScoreCalculator {
  /**
   * @param {ReturnType<import('./Weights.js').createWeights>} weights
   * @param {ReturnType<import('./Config.js').createConfig>} config
   */
  constructor(weights, config) {
    this.weights = weights;
    this.config = config;
  }

  /**
   * @param {import('./types.js').Signal[]} signals
   */
  calculate(signals) {
    /** @type {Record<string, {weighted: number, weightSum: number}>} */
    const categoryTotals = Object.fromEntries(
      CATEGORIES.map((category) => [category, { weighted: 0, weightSum: 0 }])
    );

    let bullishWeight = 0;
    let bearishWeight = 0;
    let neutralWeight = 0;

    for (const signal of signals) {
      const weight = signal.weight ?? 0;
      if (weight <= 0) continue;

      const bucket = categoryTotals[signal.category];
      if (!bucket) continue;

      const directional = weight * signal.strength;
      bucket.weightSum += weight;

      if (signal.signal === 'BULLISH') {
        bucket.weighted += directional;
        bullishWeight += directional;
      } else if (signal.signal === 'BEARISH') {
        bucket.weighted -= directional;
        bearishWeight += directional;
      } else {
        neutralWeight += weight * signal.strength;
      }
    }

    /** @type {import('./types.js').ScoreBreakdown} */
    const scoreBreakdown = {
      trend: roundTo(safeDivide(categoryTotals.trend.weighted, categoryTotals.trend.weightSum, 0) * 100, 1),
      momentum: roundTo(safeDivide(categoryTotals.momentum.weighted, categoryTotals.momentum.weightSum, 0) * 100, 1),
      volatility: roundTo(
        safeDivide(categoryTotals.volatility.weighted, categoryTotals.volatility.weightSum, 0) * 100,
        1
      ),
      orderflow: roundTo(
        safeDivide(categoryTotals.orderflow.weighted, categoryTotals.orderflow.weightSum, 0) * 100,
        1
      ),
      total: 0
    };

    const totalWeightSum = CATEGORIES.reduce((sum, c) => sum + categoryTotals[c].weightSum, 0);
    const totalWeighted = CATEGORIES.reduce((sum, c) => sum + categoryTotals[c].weighted, 0);
    const totalScore = clamp(roundTo(safeDivide(totalWeighted, totalWeightSum, 0) * 100, 1), -100, 100);
    scoreBreakdown.total = totalScore;

    const participatingWeight = bullishWeight + bearishWeight + neutralWeight;
    const dominantWeight = Math.max(bullishWeight, bearishWeight);
    const agreementRatio = safeDivide(dominantWeight, bullishWeight + bearishWeight, 0);

    let dominantDirection = 'NEUTRAL';
    if (bullishWeight > bearishWeight) dominantDirection = 'BULLISH';
    else if (bearishWeight > bullishWeight) dominantDirection = 'BEARISH';

    // Confidence blends conviction (how far the score sits from zero) with
    // how much of the participating weight agrees with the dominant side.
    const magnitudeComponent = clamp(Math.abs(totalScore), 0, 100);
    const agreementComponent = agreementRatio * 100;
    const confidence = clamp(roundTo(magnitudeComponent * 0.65 + agreementComponent * 0.35, 1), 0, 100);

    return {
      totalScore,
      scoreBreakdown,
      confidence,
      dominantDirection,
      participation: {
        bullishWeight: roundTo(bullishWeight, 2),
        bearishWeight: roundTo(bearishWeight, 2),
        neutralWeight: roundTo(neutralWeight, 2),
        totalWeight: roundTo(participatingWeight, 2)
      }
    };
  }
}
