/**
 * @file Deterministic, rule-based recommendation generation from
 * already-computed statistics. No machine learning, no randomness —
 * every recommendation traces back to a specific threshold check
 * against real computed numbers.
 * @module learning-engine/RecommendationEngine
 */

/**
 * @param {import('./types.js').IndicatorPerformance[]} indicatorPerformance
 * @param {object} config - `config.recommendation` and `config.weightOptimizer` sections.
 * @returns {import('./types.js').Recommendation[]}
 * @private
 */
function indicatorRecommendations(indicatorPerformance, config) {
  const recs = [];
  for (const perf of indicatorPerformance) {
    if (perf.appearances < config.weightOptimizer.minSampleSize) continue;

    if (perf.expectancy <= config.recommendation.underperformingExpectancyThreshold) {
      const severity = perf.winRate < config.recommendation.strongUnderperformingWinRateThreshold ? 'high' : 'medium';
      recs.push({
        type: 'REDUCE_WEIGHT',
        subject: perf.indicator,
        message: `Indicator "${perf.indicator}" shows non-positive expectancy (${perf.expectancy.toFixed(4)}) over ${perf.appearances} occurrences; weight has been reduced.`,
        severity,
      });
    } else if (perf.expectancy > 0 && perf.weight >= config.weightOptimizer.baselineWeight) {
      recs.push({
        type: 'INCREASE_WEIGHT',
        subject: perf.indicator,
        message: `Indicator "${perf.indicator}" shows positive expectancy (${perf.expectancy.toFixed(4)}) over ${perf.appearances} occurrences; weight has been increased.`,
        severity: 'low',
      });
    }
  }
  return recs;
}

/**
 * @param {import('./types.js').StrategyPerformance[]} strategyPerformance
 * @param {object} config
 * @returns {import('./types.js').Recommendation[]}
 * @private
 */
function strategyRecommendations(strategyPerformance, config) {
  const recs = [];
  for (const strat of strategyPerformance) {
    if (strat.trades < config.weightOptimizer.minSampleSize) continue;
    if (strat.stats.expectancy <= config.recommendation.underperformingExpectancyThreshold) {
      recs.push({
        type: 'STRATEGY_UNDERPERFORMING',
        subject: strat.strategyKey,
        message: `Strategy "${strat.strategyKey}" has non-positive expectancy (${strat.stats.expectancy.toFixed(4)}) over ${strat.trades} trades.`,
        severity: strat.stats.winRate < config.recommendation.strongUnderperformingWinRateThreshold ? 'high' : 'medium',
      });
    } else if (strat.stats.expectancy > 0 && strat.stats.profitFactor > 1.5) {
      recs.push({
        type: 'STRATEGY_OUTPERFORMING',
        subject: strat.strategyKey,
        message: `Strategy "${strat.strategyKey}" shows strong performance (expectancy ${strat.stats.expectancy.toFixed(4)}, profit factor ${strat.stats.profitFactor.toFixed(2)}) over ${strat.trades} trades.`,
        severity: 'low',
      });
    }
  }
  return recs;
}

/**
 * @param {import('./types.js').MarketStatePerformance[]} marketStatePerformance
 * @param {object} config
 * @returns {import('./types.js').Recommendation[]}
 * @private
 */
function marketStateRecommendations(marketStatePerformance, config) {
  const recs = [];
  for (const regime of marketStatePerformance) {
    if (regime.trades < config.weightOptimizer.minSampleSize) continue;
    if (regime.stats.expectancy <= config.recommendation.underperformingExpectancyThreshold) {
      recs.push({
        type: 'AVOID_MARKET_STATE',
        subject: regime.marketState,
        message: `Market state "${regime.marketState}" has produced non-positive expectancy (${regime.stats.expectancy.toFixed(4)}) over ${regime.trades} trades.`,
        severity: regime.stats.winRate < config.recommendation.strongUnderperformingWinRateThreshold ? 'high' : 'medium',
      });
    }
  }
  return recs;
}

/**
 * @param {import('./ConfidenceOptimizer.js').ConfidenceModel} confidenceModel
 * @returns {import('./types.js').Recommendation[]}
 * @private
 */
function calibrationRecommendations(confidenceModel) {
  if (confidenceModel.isWellCalibrated) return [];
  return [
    {
      type: 'RECALIBRATE_CONFIDENCE',
      subject: 'confidence_model',
      message: `Confidence calibration error is ${confidenceModel.meanCalibrationError.toFixed(4)} (Brier score ${confidenceModel.brierScore.toFixed(4)}); predicted confidence does not reliably match actual outcomes.`,
      severity: confidenceModel.meanCalibrationError > 0.2 ? 'high' : 'medium',
    },
  ];
}

/**
 * @param {import('./OverfittingDetector.js').OverfittingReport} overfittingReport
 * @returns {import('./types.js').Recommendation[]}
 * @private
 */
function overfittingRecommendations(overfittingReport) {
  return overfittingReport.flags
    .filter((f) => f.detected)
    .map((f) => ({
      type: 'OVERFITTING_WARNING',
      subject: f.type,
      message: f.detail,
      severity: 'high',
    }));
}

/**
 * Generate the full recommendation list from every analysis stage.
 * @param {Object} input
 * @param {import('./types.js').IndicatorPerformance[]} input.indicatorPerformance
 * @param {import('./types.js').StrategyPerformance[]} input.strategyPerformance
 * @param {import('./types.js').MarketStatePerformance[]} input.marketStatePerformance
 * @param {import('./ConfidenceOptimizer.js').ConfidenceModel} input.confidenceModel
 * @param {import('./OverfittingDetector.js').OverfittingReport} input.overfittingReport
 * @param {object} config - Full learning-engine config.
 * @returns {import('./types.js').Recommendation[]}
 */
export function generateRecommendations(input, config) {
  return [
    ...overfittingRecommendations(input.overfittingReport), // safety-relevant, surfaced first
    ...calibrationRecommendations(input.confidenceModel),
    ...indicatorRecommendations(input.indicatorPerformance, config),
    ...strategyRecommendations(input.strategyPerformance, config),
    ...marketStateRecommendations(input.marketStatePerformance, config),
  ];
}

export default { generateRecommendations };
