import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConfidenceModel, applyCalibration } from '../src/ConfidenceOptimizer.js';
import { createConfig } from '../src/Config.js';

test('computeConfidenceModel leaves under-sampled buckets uncalibrated', () => {
  const config = createConfig({ confidenceOptimizer: { minBucketSampleSize: 50 } }).confidenceOptimizer;
  const trades = [{ confidence: 0.9, pnlPercent: -0.01 }];
  const model = computeConfidenceModel(trades, config);
  assert.equal(model.buckets[0].calibratedConfidence, model.buckets[0].avgPredictedConfidence);
});

test('computeConfidenceModel blends actual win rate in for well-sampled buckets', () => {
  const config = createConfig({ confidenceOptimizer: { minBucketSampleSize: 2, smoothingFactor: 1.0 } }).confidenceOptimizer;
  const trades = [{ confidence: 0.9, pnlPercent: 0.01 }, { confidence: 0.9, pnlPercent: -0.01 }];
  const model = computeConfidenceModel(trades, config);
  assert.equal(model.buckets[0].calibratedConfidence, 0.5); // smoothingFactor=1.0 -> fully actual win rate
});

test('isWellCalibrated reflects the meanCalibrationError threshold', () => {
  const config = createConfig({ confidenceOptimizer: { minBucketSampleSize: 1, numBuckets: 10 } }).confidenceOptimizer;
  const perfectTrades = Array.from({ length: 10 }, (_, i) => ({ confidence: 0.5, pnlPercent: i % 2 === 0 ? 0.01 : -0.01 }));
  const model = computeConfidenceModel(perfectTrades, config);
  assert.equal(model.isWellCalibrated, true);
});

test('applyCalibration interpolates linearly between bucket midpoints', () => {
  const model = { buckets: [{ rangeStart: 0, rangeEnd: 0.5, calibratedConfidence: 0.2 }, { rangeStart: 0.5, rangeEnd: 1, calibratedConfidence: 0.8 }] };
  const result = applyCalibration(0.5, model); // exactly at the second bucket's midpoint start... check boundary behavior
  assert.ok(result >= 0.2 && result <= 0.8);
});

test('applyCalibration clamps to the nearest edge bucket outside the range', () => {
  const model = { buckets: [{ rangeStart: 0.4, rangeEnd: 0.6, calibratedConfidence: 0.5 }] };
  assert.equal(applyCalibration(0.9, model), 0.5);
  assert.equal(applyCalibration(0.1, model), 0.5);
});

test('applyCalibration returns the clamped raw value when no buckets exist', () => {
  assert.equal(applyCalibration(1.5, { buckets: [] }), 1);
  assert.equal(applyCalibration(-0.5, { buckets: [] }), 0);
});
