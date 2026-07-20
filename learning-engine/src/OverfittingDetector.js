/**
 * @file Overfitting and reliability-risk detection: too many
 * simultaneously-optimized parameters, recency-only performance
 * spikes, historical degradation, small-sample bias, and confidence
 * inflation.
 * @module learning-engine/OverfittingDetector
 */

import { compareRecentToHistorical } from './PerformanceAnalyzer.js';

/**
 * @typedef {Object} OverfittingFlag
 * @property {string} type
 * @property {boolean} detected
 * @property {string} detail
 */

/**
 * @typedef {Object} OverfittingReport
 * @property {boolean} anyDetected
 * @property {OverfittingFlag[]} flags
 */

/**
 * @param {import('./WeightOptimizer.js').WeightAdjustment[]} weightAdjustments
 * @param {number} totalTrades
 * @param {object} config - `config.overfitting` section.
 * @returns {OverfittingFlag}
 * @private
 */
function detectTooManyOptimizedParameters(weightAdjustments, totalTrades, config) {
  const adjustedCount = weightAdjustments.filter((a) => a.adjusted).length;
  const ratio = weightAdjustments.length === 0 ? 0 : adjustedCount / weightAdjustments.length;
  // A large fraction of parameters being actively re-tuned while the
  // overall trade sample is still small relative to the parameter
  // count is a classic overfitting precursor (too many free
  // parameters chasing too little data).
  const detected = ratio > config.maxParametersAdjustedRatio && totalTrades < adjustedCount * config.minReliableSampleSize;
  return {
    type: 'too_many_optimized_parameters',
    detected,
    detail: `${adjustedCount}/${weightAdjustments.length} indicators adjusted this cycle against ${totalTrades} total trades`,
  };
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {object} config
 * @param {object} performanceConfig
 * @returns {{spike: OverfittingFlag, degradation: OverfittingFlag}}
 * @private
 */
function detectRecentVsHistorical(trades, config, performanceConfig) {
  const { recent, historical, recentTradeCount } = compareRecentToHistorical(trades, config.recentWindowSize, performanceConfig);

  const hasEnoughData = historical.trades >= config.minReliableSampleSize && recentTradeCount >= 5;

  const spikeDetected =
    hasEnoughData &&
    historical.expectancy > 0 &&
    recent.expectancy > historical.expectancy * config.spikeMultiplierThreshold;

  const degradationDetected =
    hasEnoughData &&
    historical.expectancy > 0 &&
    recent.expectancy < historical.expectancy * config.degradationThreshold;

  return {
    spike: {
      type: 'recent_performance_spike_only',
      detected: spikeDetected,
      detail: `recent expectancy ${recent.expectancy.toFixed(4)} vs historical ${historical.expectancy.toFixed(4)}`,
    },
    degradation: {
      type: 'historical_degradation',
      detected: degradationDetected,
      detail: `recent expectancy ${recent.expectancy.toFixed(4)} vs historical ${historical.expectancy.toFixed(4)}`,
    },
  };
}

/**
 * @param {import('./types.js').IndicatorPerformance[]} indicatorPerformance
 * @param {import('./types.js').StrategyPerformance[]} strategyPerformance
 * @param {object} config
 * @returns {OverfittingFlag}
 * @private
 */
function detectSmallSampleBias(indicatorPerformance, strategyPerformance, config) {
  const smallIndicators = indicatorPerformance.filter((p) => p.appearances < config.minReliableSampleSize);
  const smallStrategies = strategyPerformance.filter((s) => s.trades < config.minReliableSampleSize);
  const detected = smallIndicators.length > 0 || smallStrategies.length > 0;
  return {
    type: 'small_sample_bias',
    detected,
    detail: `${smallIndicators.length} indicator(s) and ${smallStrategies.length} strateg(y/ies) below the ${config.minReliableSampleSize}-trade reliability threshold`,
  };
}

/**
 * @param {import('./ConfidenceOptimizer.js').ConfidenceModel} confidenceModel
 * @param {object} config
 * @returns {OverfittingFlag}
 * @private
 */
function detectConfidenceInflation(confidenceModel, config) {
  const reliableBuckets = confidenceModel.buckets.filter((b) => b.sampleSize > 0);
  if (reliableBuckets.length === 0) {
    return { type: 'confidence_inflation', detected: false, detail: 'no calibration data yet' };
  }
  const totalSamples = reliableBuckets.reduce((a, b) => a + b.sampleSize, 0);
  const avgGap =
    reliableBuckets.reduce((a, b) => a + (b.avgPredictedConfidence - b.actualWinRate) * b.sampleSize, 0) / totalSamples;
  const detected = avgGap > config.confidenceInflationThreshold;
  return {
    type: 'confidence_inflation',
    detected,
    detail: `average confidence-vs-actual-win-rate gap: ${avgGap.toFixed(4)}`,
  };
}

/**
 * Run every overfitting/reliability check and return a consolidated report.
 * @param {Object} input
 * @param {import('./types.js').CompletedTrade[]} input.trades
 * @param {import('./types.js').IndicatorPerformance[]} input.indicatorPerformance
 * @param {import('./types.js').StrategyPerformance[]} input.strategyPerformance
 * @param {import('./WeightOptimizer.js').WeightAdjustment[]} input.weightAdjustments
 * @param {import('./ConfidenceOptimizer.js').ConfidenceModel} input.confidenceModel
 * @param {object} config - Full learning-engine config (uses `overfitting` and `performance`).
 * @returns {OverfittingReport}
 */
export function detectOverfitting(input, config) {
  const { trades, indicatorPerformance, strategyPerformance, weightAdjustments, confidenceModel } = input;
  const overfittingConfig = config.overfitting;

  const paramsFlag = detectTooManyOptimizedParameters(weightAdjustments, trades.length, overfittingConfig);
  const { spike, degradation } = detectRecentVsHistorical(trades, overfittingConfig, config.performance);
  const sampleBiasFlag = detectSmallSampleBias(indicatorPerformance, strategyPerformance, overfittingConfig);
  const inflationFlag = detectConfidenceInflation(confidenceModel, overfittingConfig);

  const flags = [paramsFlag, spike, degradation, sampleBiasFlag, inflationFlag];
  return { anyDetected: flags.some((f) => f.detected), flags };
}

export default { detectOverfitting };
