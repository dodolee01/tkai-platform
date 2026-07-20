import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCagr, computePerformanceReport } from '../src/PerformanceTracker.js';

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const perfConfig = { riskFreeRatePerTrade: 0, annualizationFactor: 1 };

test('computeCagr matches the compound-growth formula for a 1-year doubling', () => {
  assert.ok(Math.abs(computeCagr(10000, 20000, YEAR_MS) - 100) < 0.01);
});

test('computeCagr returns 0 for non-positive starting equity or elapsed time', () => {
  assert.equal(computeCagr(0, 1000, YEAR_MS), 0);
  assert.equal(computeCagr(1000, 2000, 0), 0);
});

test('computeCagr returns -100 for a complete loss', () => {
  assert.equal(computeCagr(10000, 0, YEAR_MS), -100);
});

test('netProfit/grossProfit/grossLoss/profitFactor are internally consistent', () => {
  const trades = [{ realizedPnl: 200, openedAt: 0, closedAt: 1 }, { realizedPnl: -50, openedAt: 0, closedAt: 1 }];
  const report = computePerformanceReport(trades, { startEquity: 10000, currentEquity: 10150, peakEquity: 10200, lowestEquity: 9950, elapsedMs: YEAR_MS }, perfConfig);
  assert.equal(report.grossProfit, 200);
  assert.equal(report.grossLoss, 50);
  assert.equal(report.netProfit, 150);
  assert.equal(report.profitFactor, 4);
});

test('winRate and averageTrade match hand-computed values', () => {
  const trades = [{ realizedPnl: 100, openedAt: 0, closedAt: 1 }, { realizedPnl: -100, openedAt: 0, closedAt: 1 }, { realizedPnl: 50, openedAt: 0, closedAt: 1 }];
  const report = computePerformanceReport(trades, { startEquity: 10000, currentEquity: 10050, peakEquity: 10100, lowestEquity: 9900, elapsedMs: YEAR_MS }, perfConfig);
  assert.ok(Math.abs(report.winRate - 2 / 3) < 1e-9);
  assert.ok(Math.abs(report.averageTrade - 50 / 3) < 1e-9);
});

test('roi is computed from start vs current equity', () => {
  const report = computePerformanceReport([], { startEquity: 10000, currentEquity: 11000, peakEquity: 11000, lowestEquity: 9500, elapsedMs: YEAR_MS }, perfConfig);
  assert.equal(report.roi, 10);
});

test('calmarRatio and recoveryFactor use peak-to-lowest drawdown and agree with each other', () => {
  const trades = [{ realizedPnl: 500, openedAt: 0, closedAt: 1 }];
  const report = computePerformanceReport(trades, { startEquity: 10000, currentEquity: 10500, peakEquity: 10600, lowestEquity: 9800, elapsedMs: YEAR_MS }, perfConfig);
  assert.ok(Math.abs(report.calmarRatio - (500 / 800)) < 1e-9);
  assert.equal(report.recoveryFactor, report.calmarRatio);
});

test('an empty trade list produces zeroed trade-based metrics but still computes equity-based ones', () => {
  const report = computePerformanceReport([], { startEquity: 10000, currentEquity: 10500, peakEquity: 10500, lowestEquity: 9900, elapsedMs: YEAR_MS }, perfConfig);
  assert.equal(report.netProfit, 0);
  assert.equal(report.winRate, 0);
  assert.equal(report.roi, 5);
});

test('averageHoldingTimeMs averages closedAt - openedAt across trades', () => {
  const trades = [{ realizedPnl: 10, openedAt: 1000, closedAt: 4000 }, { realizedPnl: -5, openedAt: 2000, closedAt: 5000 }];
  const report = computePerformanceReport(trades, { startEquity: 10000, currentEquity: 10005, peakEquity: 10005, lowestEquity: 9995, elapsedMs: YEAR_MS }, perfConfig);
  assert.equal(report.averageHoldingTimeMs, (3000 + 3000) / 2);
});
