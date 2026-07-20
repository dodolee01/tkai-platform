/**
 * @file Builds a calibrated-confidence model from historical
 * calibration buckets: for buckets with enough samples, blends the
 * observed actual-win-rate signal into the calibrated value (damped
 * by `smoothingFactor` so a handful of trades can't swing the model).
 * @module learning-engine/ConfidenceOptimizer
 */

import { bucketByConfidence, brierScore, meanCalibrationError } from './Calibration.js';

/**
 * @typedef {Object} ConfidenceModel
 * @property {import('./types.js').CalibrationBucket[]} buckets
 * @property {number} brierScore
 * @property {number} meanCalibrationError
 * @property {boolean} isWellCalibrated
 */

/**
 * Compute the updated confidence calibration model from a trade set.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {object} config - `config.confidenceOptimizer` section.
 * @returns {ConfidenceModel}
 */
export function computeConfidenceModel(trades, config) {
  const rawBuckets = bucketByConfidence(trades, config.numBuckets);

  const buckets = rawBuckets.map((bucket) => {
    if (bucket.sampleSize < config.minBucketSampleSize) {
      // Not enough data in this bucket to trust an adjustment — leave
      // calibrated confidence equal to the raw predicted value.
      return bucket;
    }
    const blended =
      bucket.avgPredictedConfidence * (1 - config.smoothingFactor) + bucket.actualWinRate * config.smoothingFactor;
    return { ...bucket, calibratedConfidence: Math.min(1, Math.max(0, blended)) };
  });

  const error = meanCalibrationError(buckets);

  return {
    buckets,
    brierScore: brierScore(trades),
    meanCalibrationError: error,
    isWellCalibrated: error < 0.1,
  };
}

/**
 * Apply the calibration model to a single raw confidence value via
 * linear interpolation between the two nearest bucket midpoints.
 * Falls back to the raw value unchanged if no calibration data exists
 * for the relevant region.
 * @param {number} rawConfidence
 * @param {ConfidenceModel} model
 * @returns {number}
 */
export function applyCalibration(rawConfidence, model) {
  const clamped = Math.min(Math.max(rawConfidence, 0), 1);
  if (model.buckets.length === 0) return clamped;

  const midpoints = model.buckets.map((b) => ({
    x: (b.rangeStart + b.rangeEnd) / 2,
    y: b.calibratedConfidence,
  }));
  midpoints.sort((a, b) => a.x - b.x);

  if (clamped <= midpoints[0].x) return midpoints[0].y;
  if (clamped >= midpoints[midpoints.length - 1].x) return midpoints[midpoints.length - 1].y;

  for (let i = 0; i < midpoints.length - 1; i++) {
    const left = midpoints[i];
    const right = midpoints[i + 1];
    if (clamped >= left.x && clamped <= right.x) {
      const span = right.x - left.x;
      const t = span === 0 ? 0 : (clamped - left.x) / span;
      return left.y + t * (right.y - left.y);
    }
  }
  return clamped;
}

export default { computeConfidenceModel, applyCalibration };
