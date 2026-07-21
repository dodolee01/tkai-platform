import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsManager } from '../src/AnalyticsManager.js';
import { InMemoryAnalyticsRepository } from '../src/AnalyticsRepository.js';
import { createConfig } from '../src/Config.js';

test('recordTrade persists exactly once to the repository (no double-insert)', async () => {
  const repo = new InMemoryAnalyticsRepository();
  const mgr = new AnalyticsManager({ repository: repo }, createConfig());
  await mgr.initialize();
  await mgr.recordTrade({ id: 't1', symbol: 'BTCUSDT', realizedPnl: 10, confidence: 0.5, closedAt: 1, openedAt: 0 });
  assert.equal((await repo.getTrades()).length, 1);
  assert.equal(mgr.getTrades().length, 1);
});

test('multiple recordTrade calls each persist exactly once', async () => {
  const repo = new InMemoryAnalyticsRepository();
  const mgr = new AnalyticsManager({ repository: repo }, createConfig());
  await mgr.initialize();
  for (let i = 0; i < 5; i++) {
    await mgr.recordTrade({ id: `t${i}`, symbol: 'BTCUSDT', realizedPnl: i, confidence: 0.5, closedAt: i, openedAt: 0 });
  }
  assert.equal((await repo.getTrades()).length, 5);
  assert.equal(mgr.getTrades().length, 5);
});

test('getTrades filters correctly by strategy', async () => {
  const mgr = new AnalyticsManager({ repository: new InMemoryAnalyticsRepository() }, createConfig());
  await mgr.initialize();
  await mgr.recordTrade({ id: 't1', symbol: 'A', strategy: 'trend', realizedPnl: 1, confidence: 0.5, closedAt: 1, openedAt: 0 });
  await mgr.recordTrade({ id: 't2', symbol: 'B', strategy: 'meanRev', realizedPnl: 1, confidence: 0.5, closedAt: 1, openedAt: 0 });
  assert.equal(mgr.getTrades({ strategy: 'trend' }).length, 1);
});

test('computeFullAnalytics bundles every sub-report and reflects current trades', async () => {
  const mgr = new AnalyticsManager({ repository: new InMemoryAnalyticsRepository() }, createConfig());
  await mgr.initialize();
  await mgr.recordTrade({ id: 't1', symbol: 'A', realizedPnl: 100, confidence: 0.7, closedAt: 1, openedAt: 0 });
  const analytics = mgr.computeFullAnalytics();
  for (const key of ['trade', 'profit', 'loss', 'drawdown', 'performance', 'ai']) {
    assert.ok(key in analytics, `missing ${key}`);
  }
  assert.equal(analytics.trade.totalTrades, 1);
});

test('computeStrategyRankings reports changed=true on the first call, false when order is stable', async () => {
  const mgr = new AnalyticsManager({ repository: new InMemoryAnalyticsRepository() }, createConfig({ strategy: { minTradesForRanking: 1 } }));
  await mgr.initialize();
  await mgr.recordTrade({ id: 't1', symbol: 'A', strategy: 'trend', realizedPnl: 100, confidence: 0.7, closedAt: 1, openedAt: 0 });
  const first = mgr.computeStrategyRankings();
  assert.equal(first.changed, true);
  const second = mgr.computeStrategyRankings();
  assert.equal(second.changed, false);
});

test('computeStrategyRankings detects a ranking order change', async () => {
  const mgr = new AnalyticsManager({ repository: new InMemoryAnalyticsRepository() }, createConfig({ strategy: { minTradesForRanking: 1 } }));
  await mgr.initialize();
  await mgr.recordTrade({ id: 't1', symbol: 'A', strategy: 'trend', realizedPnl: 10, confidence: 0.7, closedAt: 1, openedAt: 0 });
  await mgr.recordTrade({ id: 't2', symbol: 'B', strategy: 'meanRev', realizedPnl: -5, confidence: 0.5, closedAt: 2, openedAt: 1 });
  mgr.computeStrategyRankings();
  await mgr.recordTrade({ id: 't3', symbol: 'B', strategy: 'meanRev', realizedPnl: 500, confidence: 0.9, closedAt: 3, openedAt: 2 });
  const result = mgr.computeStrategyRankings();
  assert.equal(result.changed, true);
  assert.equal(result.rankings[0].strategy, 'meanRev');
});

test('recordEquity and getEquityCurve work correctly', async () => {
  const mgr = new AnalyticsManager({ repository: new InMemoryAnalyticsRepository() }, createConfig());
  await mgr.initialize();
  mgr.recordEquity(1000, 0);
  mgr.recordEquity(1100, 1000);
  assert.equal(mgr.getEquityCurve().length, 2);
});

test('initialize() hydrates prior trade history from the repository', async () => {
  const repo = new InMemoryAnalyticsRepository();
  const first = new AnalyticsManager({ repository: repo }, createConfig());
  await first.initialize();
  await first.recordTrade({ id: 't1', symbol: 'A', realizedPnl: 1, confidence: 0.5, closedAt: 1, openedAt: 0 });

  const second = new AnalyticsManager({ repository: repo }, createConfig());
  await second.initialize();
  assert.equal(second.getTrades().length, 1);
});
