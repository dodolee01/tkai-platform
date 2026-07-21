import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsEngine } from '../src/MetricsEngine.js';

const trades = [
  { realizedPnl: 100, fees: 1, openedAt: 0, closedAt: 5000 },
  { realizedPnl: -40, fees: 1, openedAt: 0, closedAt: 3000 },
  { realizedPnl: 60, fees: 1, openedAt: 0, closedAt: 7000 },
  { realizedPnl: -30, fees: 1, openedAt: 0, closedAt: 2000 },
  { realizedPnl: -20, fees: 1, openedAt: 0, closedAt: 1000 },
];

test('win/loss counts, rates, and gross figures are correct', () => {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);
  assert.equal(engine.totalTrades, 5);
  assert.equal(engine.winCount, 2);
  assert.equal(engine.lossCount, 3);
  assert.equal(engine.grossProfit, 160);
  assert.equal(engine.grossLoss, 90);
  assert.ok(Math.abs(engine.profitFactor - 160 / 90) < 1e-9);
});

test('maxConsecutiveLosses correctly identifies the longest losing streak', () => {
  const engine = new MetricsEngine();
  engine.recordTrades(trades); // sequence: W, L, W, L, L -> longest loss streak is 2
  assert.equal(engine.maxConsecutiveLosses, 2);
  assert.equal(engine.maxConsecutiveWins, 1);
});

test('incremental one-at-a-time recording matches batch recordTrades exactly', () => {
  const batchEngine = new MetricsEngine();
  batchEngine.recordTrades(trades);
  const incrementalEngine = new MetricsEngine();
  trades.forEach((t) => incrementalEngine.recordTrade(t));
  assert.equal(batchEngine.netProfit, incrementalEngine.netProfit);
  assert.equal(batchEngine.winRate, incrementalEngine.winRate);
});

test('an empty engine returns safe zeros with no NaN or crash', () => {
  const engine = new MetricsEngine();
  assert.equal(engine.winRate, 0);
  assert.equal(engine.profitFactor, 0);
  assert.equal(engine.averageWin, 0);
  assert.equal(engine.expectancy, 0);
});
