/**
 * @file Analytics for the Decision/Learning Engines' AI output:
 * suggestion/prediction/decision accuracy, confidence calibration,
 * and AI performance trend over time.
 * @module analytics-engine/AIAnalytics
 */

import { mean } from './StatisticsEngine.js';

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {number} numBuckets
 * @returns {{bucketStart: number, bucketEnd: number, avgConfidence: number, actualWinRate: number, sampleSize: number}[]}
 */
export function computeConfidenceCalibration(trades, numBuckets = 10) {
  const width = 1 / numBuckets;
  /** @type {Map<number, import('./types.js').TradeRecord[]>} */
  const buckets = new Map();
  for (const trade of trades) {
    const clamped = Math.min(Math.max(trade.confidence, 0), 1);
    const idx = Math.min(Math.floor(clamped / width), numBuckets - 1);
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx).push(trade);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, bucketTrades]) => ({
      bucketStart: idx * width,
      bucketEnd: (idx + 1) * width,
      avgConfidence: mean(bucketTrades.map((t) => t.confidence)),
      actualWinRate: bucketTrades.filter((t) => t.realizedPnl > 0).length / bucketTrades.length,
      sampleSize: bucketTrades.length,
    }));
}

/**
 * Mean calibration error: sample-weighted mean absolute difference
 * between predicted confidence and actual win rate across buckets.
 * @param {{avgConfidence: number, actualWinRate: number, sampleSize: number}[]} buckets
 * @returns {number}
 */
export function computeCalibrationError(buckets) {
  const totalSamples = buckets.reduce((a, b) => a + b.sampleSize, 0);
  if (totalSamples === 0) return 0;
  return buckets.reduce((a, b) => a + Math.abs(b.avgConfidence - b.actualWinRate) * b.sampleSize, 0) / totalSamples;
}

/**
 * @typedef {Object} AIAnalyticsReport
 * @property {number} totalDecisions
 * @property {number|null} predictionAccuracy - Fraction of trades where `predictedDirectionCorrect === 1`; null if no trade carries that field.
 * @property {number} decisionAccuracy - Fraction of trades that were profitable (the ultimate measure of whether the AI's LONG/SHORT call was a good decision).
 * @property {number} averageConfidence
 * @property {number} calibrationError - 0 = perfectly calibrated confidence.
 * @property {{bucketStart: number, bucketEnd: number, avgConfidence: number, actualWinRate: number, sampleSize: number}[]} confidenceCalibration
 * @property {{period: string, accuracy: number, averageConfidence: number, trades: number}[]} performanceOverTime
 */

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {(timestamp: number) => string} periodKeyFn - e.g. `monthKey` from StatisticsEngine, for bucketing the trend.
 * @returns {AIAnalyticsReport}
 */
export function computeAIAnalytics(trades, periodKeyFn) {
  if (trades.length === 0) {
    return { totalDecisions: 0, predictionAccuracy: null, decisionAccuracy: 0, averageConfidence: 0, calibrationError: 0, confidenceCalibration: [], performanceOverTime: [] };
  }

  const withPrediction = trades.filter((t) => t.predictedDirectionCorrect !== undefined);
  const predictionAccuracy = withPrediction.length === 0 ? null : mean(withPrediction.map((t) => t.predictedDirectionCorrect));

  const decisionAccuracy = trades.filter((t) => t.realizedPnl > 0).length / trades.length;
  const averageConfidence = mean(trades.map((t) => t.confidence));

  const buckets = computeConfidenceCalibration(trades);
  const calibrationError = computeCalibrationError(buckets);

  /** @type {Map<string, import('./types.js').TradeRecord[]>} */
  const byPeriod = new Map();
  for (const trade of trades) {
    const key = periodKeyFn(trade.closedAt);
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key).push(trade);
  }
  const performanceOverTime = Array.from(byPeriod.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([period, periodTrades]) => ({
      period,
      accuracy: periodTrades.filter((t) => t.realizedPnl > 0).length / periodTrades.length,
      averageConfidence: mean(periodTrades.map((t) => t.confidence)),
      trades: periodTrades.length,
    }));

  return {
    totalDecisions: trades.length,
    predictionAccuracy,
    decisionAccuracy,
    averageConfidence,
    calibrationError,
    confidenceCalibration: buckets,
    performanceOverTime,
  };
}

export default { computeConfidenceCalibration, computeCalibrationError, computeAIAnalytics };
