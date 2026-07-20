import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeWeights } from '../src/WeightOptimizer.js';
import { createConfig } from '../src/Config.js';

test('positive expectancy increases weight above baseline', () => {
  const config = createConfig().weightOptimizer;
  const { updatedWeights } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: 0.05 }], {}, config);
  assert.ok(updatedWeights.a > config.baselineWeight);
});

test('negative expectancy decreases weight below baseline', () => {
  const config = createConfig().weightOptimizer;
  const { updatedWeights } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: -0.05 }], {}, config);
  assert.ok(updatedWeights.a < config.baselineWeight);
});

test('indicators below minSampleSize are never adjusted', () => {
  const config = createConfig({ weightOptimizer: { minSampleSize: 20 } }).weightOptimizer;
  const { updatedWeights, adjustments } = optimizeWeights([{ indicator: 'a', appearances: 5, expectancy: 0.5 }], { a: 1.0 }, config);
  assert.equal(updatedWeights.a, 1.0);
  assert.equal(adjustments[0].adjusted, false);
});

test('weight never exceeds maxWeight or goes below minWeight, even over many cycles', () => {
  const config = createConfig({ weightOptimizer: { maxWeight: 2, minWeight: 0.5, learningRate: 0.5 } }).weightOptimizer;
  let weights = {};
  for (let i = 0; i < 100; i++) {
    ({ updatedWeights: weights } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: 1 }], weights, config));
  }
  assert.ok(weights.a <= 2);
  let weights2 = {};
  for (let i = 0; i < 100; i++) {
    ({ updatedWeights: weights2 } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: -1 }], weights2, config));
  }
  assert.ok(weights2.a >= 0.5);
});

test('decay pulls weight back toward baseline even with zero expectancy signal', () => {
  const config = createConfig({ weightOptimizer: { decayFactor: 0.5 } }).weightOptimizer;
  const { updatedWeights } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: 0 }], { a: 2.0 }, config);
  assert.ok(updatedWeights.a < 2.0);
  assert.ok(updatedWeights.a > config.baselineWeight);
});

test('a single huge-magnitude expectancy does not blow past the per-cycle learningRate cap', () => {
  const config = createConfig({ weightOptimizer: { learningRate: 0.05, decayFactor: 0 } }).weightOptimizer;
  const { updatedWeights } = optimizeWeights([{ indicator: 'a', appearances: 50, expectancy: 999 }], { a: 1.0 }, config);
  assert.ok(updatedWeights.a <= 1.0 * 1.05 + 1e-9); // tanh-normalized signal caps the step at ~learningRate
});
