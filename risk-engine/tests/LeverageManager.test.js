import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAdjustedLeverage } from '../src/LeverageManager.js';
import { createConfig } from '../src/Config.js';

test('leverage is unchanged under favorable conditions', () => {
  const config = createConfig().leverage;
  const { leverage, reductions } = computeAdjustedLeverage(
    { recommendedLeverage: 5, volatility: 0.01, confidence: 0.9, currentDrawdownPct: 0 },
    config
  );
  assert.equal(leverage, 5);
  assert.deepEqual(reductions, []);
});

test('leverage never exceeds the Decision Engine recommendation', () => {
  const config = createConfig({ leverage: { maxLeverage: 50 } }).leverage;
  const { leverage } = computeAdjustedLeverage(
    { recommendedLeverage: 3, volatility: 0.001, confidence: 0.99, currentDrawdownPct: 0 },
    config
  );
  assert.ok(leverage <= 3);
});

test('leverage is reduced under high volatility', () => {
  const config = createConfig().leverage;
  const { leverage, reductions } = computeAdjustedLeverage(
    { recommendedLeverage: 5, volatility: 0.1, confidence: 0.9, currentDrawdownPct: 0 },
    config
  );
  assert.ok(leverage < 5);
  assert.ok(reductions.includes('high_volatility'));
});

test('leverage is reduced under drawdown protection', () => {
  const config = createConfig().leverage;
  const { leverage, reductions } = computeAdjustedLeverage(
    { recommendedLeverage: 5, volatility: 0.01, confidence: 0.9, currentDrawdownPct: 0.5 },
    config
  );
  assert.ok(leverage < 5);
  assert.ok(reductions.includes('drawdown_protection'));
});

test('leverage respects the configured floor', () => {
  const config = createConfig({ leverage: { minLeverage: 2 } }).leverage;
  const { leverage } = computeAdjustedLeverage(
    { recommendedLeverage: 1, volatility: 0.5, confidence: 0.1, currentDrawdownPct: 0.9 },
    config
  );
  assert.ok(leverage >= 1); // never exceeds recommendation, even if floor is higher
});
