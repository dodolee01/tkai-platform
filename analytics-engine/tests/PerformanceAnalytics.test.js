import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/PerformanceAnalytics.js';
import { createConfig } from '../src/Config.js';

test('Sharpe is 0 for a zero-volatility return series', () => {
  assert.equal(P.computeSharpeRatio([1, 1, 1], 0, 1), 0);
});

test('Sortino ignores upside volatility entirely', () => {
  assert.equal(P.computeSortinoRatio([1, 50, 2], 0, 1), Infinity);
});

test('Calmar, RecoveryFactor, and EdgeRatio match their textbook formulas', () => {
  assert.equal(P.computeCalmarRatio(20, 10), 2);
  assert.equal(P.computeRecoveryFactor(500, 250), 2);
  assert.equal(P.computeEdgeRatio(100, 50), 2);
});

test('Omega ratio exceeds 1 for a net-positive return series', () => {
  assert.ok(P.computeOmegaRatio([1, -0.5, 2, -0.5]) > 1);
});

test('Beta correctly recovers a known linear relationship via regression', () => {
  const benchmarkReturns = [0.01, 0.02, -0.01, 0.03];
  const portfolioReturns = benchmarkReturns.map((r) => r * 2);
  assert.ok(Math.abs(P.computeBeta(portfolioReturns, benchmarkReturns) - 2) < 1e-9);
});

test('Treynor ratio matches its formula exactly', () => {
  assert.equal(P.computeTreynorRatio(0.1, 0.02, 2), 0.04);
});

test('computePerformanceAnalytics omits alpha/beta/IR/Treynor without a benchmark, includes them with one', () => {
  const config = createConfig().performance;
  const trades = [{ realizedPnl: 100, closedAt: 1 }, { realizedPnl: -30, closedAt: 2 }, { realizedPnl: 60, closedAt: 3 }];
  const equityContext = { startEquity: 1000, currentEquity: 1130, averageEquity: 1065, maxDrawdownPct: 10, maxDrawdownAbs: 100, annualizedReturnPct: 20 };

  const withoutBenchmark = P.computePerformanceAnalytics(trades, equityContext, config);
  assert.equal(withoutBenchmark.alpha, null);
  assert.equal(withoutBenchmark.beta, null);

  const withBenchmark = P.computePerformanceAnalytics(trades, equityContext, config, [50, -10, 30]);
  assert.notEqual(withBenchmark.beta, null);
  assert.equal(typeof withBenchmark.beta, 'number');
});

test('roi is computed from start vs current equity', () => {
  const config = createConfig().performance;
  const report = P.computePerformanceAnalytics([], { startEquity: 1000, currentEquity: 1130, averageEquity: 1065, maxDrawdownPct: 0, maxDrawdownAbs: 0, annualizedReturnPct: 0 }, config);
  assert.ok(Math.abs(report.roi - 13) < 1e-9);
});

test('every documented metric field is present in the report', () => {
  const config = createConfig().performance;
  const report = P.computePerformanceAnalytics([], { startEquity: 1000, currentEquity: 1000, averageEquity: 1000, maxDrawdownPct: 0, maxDrawdownAbs: 0, annualizedReturnPct: 0 }, config);
  for (const key of ['roi', 'roe', 'sharpeRatio', 'sortinoRatio', 'calmarRatio', 'omegaRatio', 'recoveryFactor', 'expectancy', 'edgeRatio', 'alpha', 'beta', 'informationRatio', 'treynorRatio']) {
    assert.ok(key in report, `missing ${key}`);
  }
});
