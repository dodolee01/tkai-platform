import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategyKeyFn, computeStrategyPerformance } from '../src/StrategyStatistics.js';

const perfConfig = { riskFreeRatePerTrade: 0, annualizationFactor: 1 };

test('buildStrategyKeyFn joins the specified fields', () => {
  const keyFn = buildStrategyKeyFn(['decision', 'timeframe']);
  assert.equal(keyFn({ decision: 'LONG', timeframe: '1h' }), 'LONG:1h');
});

test('buildStrategyKeyFn falls back to "unknown" for missing fields', () => {
  const keyFn = buildStrategyKeyFn(['decision', 'strategyName']);
  assert.equal(keyFn({ decision: 'LONG' }), 'LONG:unknown');
});

test('computeStrategyPerformance groups trades and computes per-group stats', () => {
  const trades = [
    { decision: 'LONG', timeframe: '15m', pnlPercent: 0.02 },
    { decision: 'LONG', timeframe: '15m', pnlPercent: 0.01 },
    { decision: 'SHORT', timeframe: '1h', pnlPercent: -0.01 },
  ];
  const keyFn = buildStrategyKeyFn(['decision', 'timeframe']);
  const result = computeStrategyPerformance(trades, keyFn, perfConfig);
  assert.equal(result.length, 2);
  const longStrat = result.find((r) => r.strategyKey === 'LONG:15m');
  assert.equal(longStrat.trades, 2);
  assert.equal(longStrat.stats.winRate, 1);
});

test('computeStrategyPerformance sorts by expectancy descending', () => {
  const trades = [
    { decision: 'A', timeframe: 'x', pnlPercent: -0.05 },
    { decision: 'B', timeframe: 'x', pnlPercent: 0.05 },
  ];
  const keyFn = buildStrategyKeyFn(['decision', 'timeframe']);
  const result = computeStrategyPerformance(trades, keyFn, perfConfig);
  assert.equal(result[0].strategyKey, 'B:x');
});
