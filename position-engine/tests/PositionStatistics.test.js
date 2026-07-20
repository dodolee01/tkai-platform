import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatistics } from '../src/PositionStatistics.js';

const perfConfig = { riskFreeRatePerTrade: 0, annualizationFactor: 1 };

test('empty position list returns a fully zeroed report', () => {
  const stats = computeStatistics([], perfConfig);
  assert.equal(stats.totalTrades, 0);
  assert.equal(stats.winRate, 0);
  assert.equal(stats.profitFactor, 0);
});

test('win/loss rates and averages match hand-computed values', () => {
  const positions = [
    { realizedPnl: 100, openedAt: 0, closedAt: 1000 },
    { realizedPnl: -40, openedAt: 0, closedAt: 1000 },
    { realizedPnl: 60, openedAt: 0, closedAt: 1000 },
  ];
  const stats = computeStatistics(positions, perfConfig);
  assert.ok(Math.abs(stats.winRate - 2 / 3) < 1e-9);
  assert.equal(stats.averageWin, 80);
  assert.equal(stats.averageLoss, 40);
  assert.equal(stats.largestWin, 100);
  assert.equal(stats.largestLoss, 40);
});

test('profitFactor is gross profit over gross loss', () => {
  const positions = [{ realizedPnl: 100 }, { realizedPnl: -25 }];
  const stats = computeStatistics(positions, perfConfig);
  assert.equal(stats.profitFactor, 4);
});

test('profitFactor handles zero-loss and zero-win edge cases', () => {
  assert.equal(computeStatistics([{ realizedPnl: 50 }], perfConfig).profitFactor, Infinity);
  assert.equal(computeStatistics([{ realizedPnl: -50 }], perfConfig).profitFactor, 0);
});

test('expectancy matches the textbook formula', () => {
  const positions = [{ realizedPnl: 100 }, { realizedPnl: -40 }];
  const stats = computeStatistics(positions, perfConfig);
  const expected = stats.winRate * stats.averageWin - stats.lossRate * stats.averageLoss;
  assert.ok(Math.abs(stats.expectancy - expected) < 1e-9);
});

test('averageHoldingTimeMs averages closedAt - openedAt across all trades', () => {
  const positions = [
    { realizedPnl: 10, openedAt: 1000, closedAt: 5000 },
    { realizedPnl: -10, openedAt: 2000, closedAt: 4000 },
  ];
  const stats = computeStatistics(positions, perfConfig);
  assert.equal(stats.averageHoldingTimeMs, (4000 + 2000) / 2);
});

test('recoveryFactor relates total PnL to max drawdown along the equity path', () => {
  const positions = [{ realizedPnl: 100 }, { realizedPnl: -50 }, { realizedPnl: 80 }];
  const stats = computeStatistics(positions, perfConfig);
  assert.ok(Number.isFinite(stats.recoveryFactor));
  assert.ok(stats.recoveryFactor > 0);
});
