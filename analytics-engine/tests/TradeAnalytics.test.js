import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTradeAnalytics } from '../src/TradeAnalytics.js';

test('counts, win rate, and largest win/loss are correct', () => {
  const day1 = Date.parse('2026-01-01T10:00:00Z');
  const trades = [
    { realizedPnl: 100, closedAt: day1, openedAt: day1 - 1000 },
    { realizedPnl: -50, closedAt: day1 + 1000, openedAt: day1 },
    { realizedPnl: 30, closedAt: day1 + 2000, openedAt: day1 + 1000 },
  ];
  const report = computeTradeAnalytics(trades);
  assert.equal(report.totalTrades, 3);
  assert.equal(report.winningTrades, 2);
  assert.equal(report.losingTrades, 1);
  assert.ok(Math.abs(report.winRate - 2 / 3) < 1e-9);
  assert.equal(report.largestWin, 100);
  assert.equal(report.largestLoss, 50);
});

test('trade frequency is averaged per distinct calendar bucket present in the data', () => {
  const day1 = Date.parse('2026-01-01T10:00:00Z');
  const day2 = Date.parse('2026-01-02T10:00:00Z');
  const trades = [
    { realizedPnl: 10, closedAt: day1, openedAt: day1 },
    { realizedPnl: 10, closedAt: day1 + 1000, openedAt: day1 },
    { realizedPnl: 10, closedAt: day2, openedAt: day2 },
  ];
  const report = computeTradeAnalytics(trades);
  assert.equal(report.tradesPerDay, 1.5);
});

test('an empty trade list returns a fully zeroed report without throwing', () => {
  const report = computeTradeAnalytics([]);
  assert.equal(report.totalTrades, 0);
  assert.equal(report.winRate, 0);
  assert.equal(report.tradesPerDay, 0);
});

test('every documented field is present', () => {
  const report = computeTradeAnalytics([{ realizedPnl: 1, closedAt: 1, openedAt: 0 }]);
  for (const key of ['totalTrades', 'winningTrades', 'losingTrades', 'winRate', 'averageWin', 'averageLoss', 'largestWin', 'largestLoss', 'averageHoldingTimeMs', 'tradesPerDay', 'tradesPerWeek', 'tradesPerMonth']) {
    assert.ok(key in report, `missing ${key}`);
  }
});
