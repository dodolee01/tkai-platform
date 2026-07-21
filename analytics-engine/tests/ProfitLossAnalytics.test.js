import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProfitDistribution, computeProfitAnalytics } from '../src/ProfitAnalytics.js';
import { computeRecoveryEpisodes, computeLossAnalytics } from '../src/LossAnalytics.js';

test('profit distribution buckets winning trades and preserves total count', () => {
  const dist = computeProfitDistribution([10, 20, 30, 100], 3);
  assert.equal(dist.length, 3);
  assert.equal(dist.reduce((a, b) => a + b.count, 0), 4);
});

test('profit analytics computes netProfit, profitFactor, and medianWin correctly', () => {
  const day1 = Date.parse('2026-01-01T10:00:00Z');
  const trades = [
    { realizedPnl: 100, closedAt: day1 },
    { realizedPnl: -50, closedAt: day1 + 1000 },
    { realizedPnl: 60, closedAt: day1 + 2000 },
  ];
  const report = computeProfitAnalytics(trades);
  assert.equal(report.netProfit, 110);
  assert.ok(Math.abs(report.profitFactor - 160 / 50) < 1e-9);
  assert.equal(report.medianWin, 80);
});

test('recovery episodes find the true trough and measure recovery from it', () => {
  const t0 = 0;
  const trades = [
    { realizedPnl: 100, closedAt: t0 },
    { realizedPnl: -60, closedAt: t0 + 1000 },
    { realizedPnl: -20, closedAt: t0 + 2000 }, // true trough here
    { realizedPnl: 90, closedAt: t0 + 3000 }, // recovers past the peak
  ];
  const episodes = computeRecoveryEpisodes(trades);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].troughValue, 20);
  assert.equal(episodes[0].recoveryTimeMs, 1000); // from the true trough at t0+2000 to recovery at t0+3000
});

test('an unresolved drawdown at the end of history has null recovery fields', () => {
  const trades = [{ realizedPnl: 100, closedAt: 0 }, { realizedPnl: -30, closedAt: 1000 }];
  const episodes = computeRecoveryEpisodes(trades);
  assert.equal(episodes[0].recoveredAt, null);
  assert.equal(episodes[0].recoveryTimeMs, null);
});

test('loss analytics computes lossFrequency, maxConsecutiveLosses, and unresolvedDrawdown', () => {
  const trades = [
    { realizedPnl: 100, closedAt: 0 },
    { realizedPnl: -60, closedAt: 1000 },
    { realizedPnl: -20, closedAt: 2000 },
  ];
  const report = computeLossAnalytics(trades);
  assert.ok(Math.abs(report.lossFrequency - 2 / 3) < 1e-9);
  assert.equal(report.maxConsecutiveLosses, 2);
  assert.equal(report.unresolvedDrawdown, 80);
});
