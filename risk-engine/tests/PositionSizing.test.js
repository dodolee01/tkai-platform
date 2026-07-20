import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePositionSize, fixedSize, percentageOfEquitySize, volatilityAdjustedSize, confidenceAdjustedSize } from '../src/PositionSizing.js';
import { createConfig } from '../src/Config.js';

test('fixedSize returns the configured fixed quote size', () => {
  const config = createConfig({ positionSizing: { fixedSizeQuote: 500 } }).positionSizing;
  assert.equal(fixedSize(config), 500);
});

test('percentageOfEquitySize scales with equity', () => {
  const config = createConfig({ positionSizing: { percentageOfEquity: 0.05 } }).positionSizing;
  assert.equal(percentageOfEquitySize(20000, config), 1000);
});

test('volatilityAdjustedSize shrinks as volatility rises above baseline', () => {
  const config = createConfig().positionSizing;
  const normal = volatilityAdjustedSize(10000, 0.02, config);
  const high = volatilityAdjustedSize(10000, 0.08, config);
  assert.ok(high < normal);
});

test('confidenceAdjustedSize scales between the floor and full size', () => {
  const config = createConfig().positionSizing;
  const atMin = confidenceAdjustedSize(10000, 0.55, 0.55, config);
  const atMax = confidenceAdjustedSize(10000, 1.0, 0.55, config);
  assert.ok(Math.abs(atMin - percentageOfEquitySize(10000, config) * config.confidenceScalingFloor) < 1e-9);
  assert.ok(atMax > atMin);
});

test('computePositionSize clamps to maxPositionPctOfEquity', () => {
  const config = createConfig({ positionSizing: { method: 'fixed', fixedSizeQuote: 999999, maxPositionPctOfEquity: 0.2 } });
  const size = computePositionSize({ equity: 10000, entryPrice: 100, atr: 1, volatility: 0.01, confidence: 0.8 }, config);
  assert.equal(size, 2000);
});

test('computePositionSize returns 0 below minPositionSizeQuote', () => {
  const config = createConfig({ positionSizing: { method: 'fixed', fixedSizeQuote: 1, minPositionSizeQuote: 50 } });
  const size = computePositionSize({ equity: 10000, entryPrice: 100, atr: 1, volatility: 0.01, confidence: 0.8 }, config);
  assert.equal(size, 0);
});

test('computePositionSize falls back to percentageOfEquity when Kelly is unusable', () => {
  const config = createConfig({ positionSizing: { method: 'kelly', percentageOfEquity: 0.03 } });
  const size = computePositionSize(
    { equity: 10000, entryPrice: 100, atr: 1, volatility: 0.01, confidence: 0.8, tradeStats: { winRate: 0.5, avgWinPct: 1, avgLossPct: 1, sampleSize: 1 } },
    config
  );
  assert.equal(size, 300); // 3% of equity, unclamped
});
