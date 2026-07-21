import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCorrelationMatrix, findHighlyCorrelatedPairs, buildSymbolReturnSeries } from '../src/CorrelationEngine.js';
import { computeReturnsFromPrices, compareToBenchmark, compareToAllBenchmarks } from '../src/BenchmarkEngine.js';

test('correlation matrix has a 1.0 diagonal and correct off-diagonal values', () => {
  const series = { A: [1, 2, 3, 4, 5], B: [2, 4, 6, 8, 10], C: [5, 4, 3, 2, 1] };
  const { matrix } = computeCorrelationMatrix(series);
  assert.equal(matrix[0][0], 1);
  assert.ok(Math.abs(matrix[0][1] - 1) < 1e-9);
  assert.ok(Math.abs(matrix[0][2] + 1) < 1e-9);
});

test('findHighlyCorrelatedPairs filters by threshold and sorts by |correlation| descending', () => {
  const series = { A: [1, 2, 3, 4], B: [2, 4, 6, 8], C: [1, 1, 2, 2] };
  const pairs = findHighlyCorrelatedPairs(series, 0.99);
  assert.ok(pairs.every((p) => Math.abs(p.correlation) >= 0.99));
});

test('buildSymbolReturnSeries excludes sparse symbols and returns bucketCount-length series', () => {
  const trades = [];
  for (let i = 0; i < 25; i++) trades.push({ symbol: 'BTCUSDT', realizedPnl: 1, closedAt: i * 1000 });
  for (let i = 0; i < 5; i++) trades.push({ symbol: 'SOLUSDT', realizedPnl: 1, closedAt: i * 1000 });
  const series = buildSymbolReturnSeries(trades, 10);
  assert.ok('BTCUSDT' in series);
  assert.ok(!('SOLUSDT' in series));
  assert.equal(series.BTCUSDT.length, 10);
});

test('computeReturnsFromPrices computes correct period-over-period returns', () => {
  const prices = [{ price: 100, timestamp: 0 }, { price: 110, timestamp: 1 }, { price: 105, timestamp: 2 }];
  const returns = computeReturnsFromPrices(prices);
  assert.ok(Math.abs(returns[0] - 0.1) < 1e-9);
  assert.ok(Math.abs(returns[1] - (-0.04545454545)) < 1e-6);
});

test('compareToBenchmark correctly compounds returns and flags outperformance', () => {
  const prices = [{ price: 100, timestamp: 0 }, { price: 110, timestamp: 1 }, { price: 105, timestamp: 2 }, { price: 120, timestamp: 3 }];
  const portfolioReturns = [0.05, 0.03, 0.08];
  const comparison = compareToBenchmark('BTC', portfolioReturns, prices);
  const expectedPortfolioReturn = (1.05 * 1.03 * 1.08 - 1) * 100;
  assert.ok(Math.abs(comparison.portfolioReturnPct - expectedPortfolioReturn) < 0.001);
  assert.equal(comparison.outperformed, comparison.portfolioReturnPct > comparison.benchmarkReturnPct);
});

test('compareToAllBenchmarks compares against every supplied benchmark', () => {
  const prices = [{ price: 100, timestamp: 0 }, { price: 105, timestamp: 1 }];
  const results = compareToAllBenchmarks([0.02], { BTC: prices, ETH: prices });
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.benchmarkName).sort(), ['BTC', 'ETH']);
});
