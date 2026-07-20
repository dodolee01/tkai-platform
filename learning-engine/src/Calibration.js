/**
 * @file Confidence calibration math: bucketing predicted confidence
 * against actual outcomes, and standard calibration-quality metrics
 * (Brier score, mean calibration error).
 * @module learning-engine/Calibration
 */

/**
 * Bucket trades by predicted confidence into `numBuckets` equal-width
 * bins over [0, 1], and compute each bucket's actual win rate.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {number} numBuckets
 * @returns {import('./types.js').CalibrationBucket[]} One entry per non-empty bucket, `bucketIndex` ascending. `calibratedConfidence` is left equal to `avgPredictedConfidence` here — {@link module:learning-engine/ConfidenceOptimizer} fills in the actual adjustment.
 */
export function bucketByConfidence(trades, numBuckets) {
  const width = 1 / numBuckets;
  /** @type {Map<number, import('./types.js').CompletedTrade[]>} */
  const buckets = new Map();

  for (const trade of trades) {
    const clamped = Math.min(Math.max(trade.confidence, 0), 1);
    const index = Math.min(Math.floor(clamped / width), numBuckets - 1);
    if (!buckets.has(index)) buckets.set(index, []);
    buckets.get(index).push(trade);
  }

  const results = [];
  for (const [bucketIndex, bucketTrades] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const avgPredictedConfidence = bucketTrades.reduce((a, t) => a + t.confidence, 0) / bucketTrades.length;
    const actualWinRate = bucketTrades.filter((t) => t.pnlPercent > 0).length / bucketTrades.length;
    results.push({
      bucketIndex,
      rangeStart: bucketIndex * width,
      rangeEnd: (bucketIndex + 1) * width,
      sampleSize: bucketTrades.length,
      avgPredictedConfidence,
      actualWinRate,
      calibratedConfidence: avgPredictedConfidence,
    });
  }
  return results;
}

/**
 * Brier score: mean squared error between predicted confidence
 * (treated as a win-probability forecast) and the binary outcome.
 * Lower is better; 0 is perfect, 1 is worst possible.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number}
 */
export function brierScore(trades) {
  if (trades.length === 0) return 0;
  const sumSquaredError = trades.reduce((a, t) => {
    const outcome = t.pnlPercent > 0 ? 1 : 0;
    return a + (t.confidence - outcome) ** 2;
  }, 0);
  return sumSquaredError / trades.length;
}

/**
 * Mean calibration error: sample-size-weighted mean absolute
 * difference between predicted confidence and actual win rate across
 * buckets. 0 = perfectly calibrated.
 * @param {import('./types.js').CalibrationBucket[]} buckets
 * @returns {number}
 */
export function meanCalibrationError(buckets) {
  const totalSamples = buckets.reduce((a, b) => a + b.sampleSize, 0);
  if (totalSamples === 0) return 0;
  const weightedError = buckets.reduce(
    (a, b) => a + Math.abs(b.avgPredictedConfidence - b.actualWinRate) * b.sampleSize,
    0
  );
  return weightedError / totalSamples;
}

export default { bucketByConfidence, brierScore, meanCalibrationError };
