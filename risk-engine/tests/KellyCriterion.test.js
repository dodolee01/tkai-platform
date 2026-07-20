import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRawKellyFraction, computeKellyPositionFraction } from '../src/KellyCriterion.js';
import { createConfig } from '../src/Config.js';

test('computeRawKellyFraction matches the textbook formula', () => {
  const f = computeRawKellyFraction({ winRate: 0.6, avgWinPct: 1.5, avgLossPct: 1 });
  assert.ok(Math.abs(f - (0.6 - 0.4 / 1.5)) < 1e-9);
});

test('computeRawKellyFraction throws on non-positive avgLossPct', () => {
  assert.throws(() => computeRawKellyFraction({ winRate: 0.5, avgWinPct: 1, avgLossPct: 0 }));
});

test('computeKellyPositionFraction is unusable below minSampleTrades', () => {
  const config = createConfig().kelly;
  const result = computeKellyPositionFraction({ winRate: 0.7, avgWinPct: 2, avgLossPct: 1, sampleSize: 3 }, config);
  assert.equal(result.usable, false);
  assert.equal(result.fraction, 0);
});

test('computeKellyPositionFraction is unusable with a negative edge', () => {
  const config = createConfig().kelly;
  const result = computeKellyPositionFraction({ winRate: 0.2, avgWinPct: 1, avgLossPct: 1, sampleSize: 100 }, config);
  assert.equal(result.usable, false);
});

test('computeKellyPositionFraction applies the fractional multiplier and cap', () => {
  const config = createConfig({ kelly: { kellyFractionMultiplier: 0.5, maxKellyFraction: 0.1, minSampleTrades: 10 } }).kelly;
  const result = computeKellyPositionFraction({ winRate: 0.9, avgWinPct: 5, avgLossPct: 1, sampleSize: 100 }, config);
  assert.equal(result.usable, true);
  assert.equal(result.fraction, 0.1); // capped
});
