import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketByConfidence, brierScore, meanCalibrationError } from '../src/Calibration.js';

test('bucketByConfidence assigns trades to the correct equal-width bucket', () => {
  const trades = [{ confidence: 0.05, pnlPercent: 0.01 }, { confidence: 0.95, pnlPercent: -0.01 }];
  const buckets = bucketByConfidence(trades, 10);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].bucketIndex, 0);
  assert.equal(buckets[1].bucketIndex, 9);
});

test('bucketByConfidence clamps out-of-range confidence values', () => {
  const trades = [{ confidence: 1.5, pnlPercent: 0.01 }, { confidence: -0.5, pnlPercent: -0.01 }];
  const buckets = bucketByConfidence(trades, 10);
  assert.equal(buckets.find((b) => b.bucketIndex === 9).sampleSize, 1);
  assert.equal(buckets.find((b) => b.bucketIndex === 0).sampleSize, 1);
});

test('brierScore is 0 for perfect predictions', () => {
  const trades = [{ confidence: 1, pnlPercent: 0.01 }, { confidence: 0, pnlPercent: -0.01 }];
  assert.equal(brierScore(trades), 0);
});

test('brierScore is 1 for maximally wrong predictions', () => {
  const trades = [{ confidence: 0, pnlPercent: 0.01 }, { confidence: 1, pnlPercent: -0.01 }];
  assert.equal(brierScore(trades), 1);
});

test('meanCalibrationError weights buckets by sample size', () => {
  const buckets = [
    { avgPredictedConfidence: 0.9, actualWinRate: 0.5, sampleSize: 10 }, // error 0.4
    { avgPredictedConfidence: 0.5, actualWinRate: 0.5, sampleSize: 90 }, // error 0
  ];
  const mce = meanCalibrationError(buckets);
  assert.ok(Math.abs(mce - (0.4 * 10) / 100) < 1e-9);
});
