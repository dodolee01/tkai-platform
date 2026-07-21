import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AnalyticsEngine } from '../src/AnalyticsEngine.js';
import { AnalyticsEventNames } from '../src/AnalyticsEvents.js';

function makeTrade(overrides = {}) {
  return { id: 't1', symbol: 'BTCUSDT', strategy: 'trend', realizedPnl: 100, confidence: 0.7, closedAt: 1000, openedAt: 0, ...overrides };
}

test('recordTrade persists exactly once and emits analyticsUpdated + performanceUpdated', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  const events = [];
  engine.eventPublisher.on(AnalyticsEventNames.ANALYTICS_UPDATED, () => events.push('analytics'));
  engine.eventPublisher.on(AnalyticsEventNames.PERFORMANCE_UPDATED, () => events.push('performance'));
  await engine.recordTrade(makeTrade());
  assert.deepEqual(events, ['analytics', 'performance']);
  assert.equal(engine.getAnalytics().trade.totalTrades, 1);
});

test('strategyRankChanged fires only when the ranking order actually changes', async () => {
  const engine = new AnalyticsEngine({}, { strategy: { minTradesForRanking: 1 } });
  await engine.initialize();
  let rankChangeCount = 0;
  engine.eventPublisher.on(AnalyticsEventNames.STRATEGY_RANK_CHANGED, () => rankChangeCount++);
  await engine.recordTrade(makeTrade({ id: 't1', strategy: 'trend', realizedPnl: 10 }));
  await engine.recordTrade(makeTrade({ id: 't2', strategy: 'trend', realizedPnl: 10 })); // same strategy, order can't change
  assert.equal(rankChangeCount, 1); // only the first call establishes an initial (changed) ranking
});

test('subscribeToEngine maps external events into recorded trades', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  const fakeEmitter = new EventEmitter();
  engine.subscribeToEngine(fakeEmitter, {
    positionClosed: (p) => ({ id: p.id, symbol: p.symbol, realizedPnl: p.realizedPnl, confidence: 0.6, closedAt: 2000, openedAt: 1000 }),
  });
  fakeEmitter.emit('positionClosed', { id: 'p1', symbol: 'ETHUSDT', realizedPnl: 50 });
  await new Promise((r) => setTimeout(r, 10)); // allow the async recordTrade inside the handler to settle
  assert.equal(engine.getAnalytics().trade.totalTrades, 1);
});

test('a throwing event mapper is caught and never crashes the engine', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  const fakeEmitter = new EventEmitter();
  engine.subscribeToEngine(fakeEmitter, { badEvent: () => { throw new Error('mapper bug'); } });
  assert.doesNotThrow(() => fakeEmitter.emit('badEvent', {}));
});

test('updateForecast computes and publishes a full forecast bundle', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  for (let i = 0; i < 10; i++) engine.recordEquity(1000 + i * 10, i * 86400000);
  let published = null;
  engine.eventPublisher.on(AnalyticsEventNames.FORECAST_UPDATED, (f) => { published = f; });
  const forecast = engine.updateForecast([5, 6, 4], [20, 25, 22]);
  for (const key of ['performance', 'drawdown', 'growth', 'risk']) assert.ok(key in forecast, `missing ${key}`);
  assert.equal(published, forecast);
});

test('updateHeatmaps computes and publishes a full heatmap bundle', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  await engine.recordTrade(makeTrade());
  let published = null;
  engine.eventPublisher.on(AnalyticsEventNames.HEATMAP_UPDATED, (h) => { published = h; });
  const heatmaps = engine.updateHeatmaps();
  for (const key of ['profit', 'loss', 'tradingTime', 'hourly', 'daily', 'monthly']) assert.ok(key in heatmaps, `missing ${key}`);
  assert.equal(published, heatmaps);
});

test('generateReport persists to the repository and emits reportGenerated', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  await engine.recordTrade(makeTrade({ closedAt: Date.now() }));
  let published = null;
  engine.eventPublisher.on(AnalyticsEventNames.REPORT_GENERATED, (r) => { published = r; });
  const report = await engine.generateReport('daily');
  assert.equal(report.period, 'daily');
  assert.equal(published.id, report.id);
});

test('generateCustomReport works for an arbitrary date range', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  const report = await engine.generateCustomReport(0, Date.now() + 1000);
  assert.equal(report.period, 'custom');
});

test('getDashboardSnapshot returns a compact bundle with headline KPIs', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  await engine.recordTrade(makeTrade());
  const snapshot = engine.getDashboardSnapshot();
  assert.ok('headline' in snapshot);
  assert.equal(snapshot.headline.totalTrades, 1);
});

test('export() dispatches correctly to every supported format', async () => {
  const engine = new AnalyticsEngine();
  const json = engine.export('json', { a: 1 });
  assert.equal(JSON.parse(json).a, 1);
  const csv = engine.export('csv', [{ a: 1 }]);
  assert.ok(csv.includes('a'));
  const excel = engine.export('excel', [{ a: 1 }]);
  assert.ok(excel.includes('<?xml'));
  const pdf = engine.export('pdf', { a: 1 });
  assert.ok(pdf.includes('<!DOCTYPE html>'));
  assert.throws(() => engine.export('bogus', {}));
});

test('getStrategyAnalytics, getSymbolCorrelationMatrix, and getBenchmarkComparison work end to end', async () => {
  const engine = new AnalyticsEngine({}, { strategy: { minTradesForRanking: 1 } });
  await engine.initialize();
  await engine.recordTrade(makeTrade({ id: 't1' }));
  await engine.recordTrade(makeTrade({ id: 't2', realizedPnl: -20 }));

  const strategies = engine.getStrategyAnalytics();
  assert.ok(strategies.length >= 1);

  const correlation = engine.getSymbolCorrelationMatrix(1);
  assert.ok('names' in correlation && 'matrix' in correlation);

  const benchmarkResults = engine.getBenchmarkComparison({ BTC: [{ price: 100, timestamp: 0 }, { price: 105, timestamp: 1 }, { price: 110, timestamp: 2 }] });
  assert.equal(benchmarkResults[0].benchmarkName, 'BTC');
});

test('shutdown unsubscribes every event mapping', async () => {
  const engine = new AnalyticsEngine();
  await engine.initialize();
  const fakeEmitter = new EventEmitter();
  let callCount = 0;
  engine.subscribeToEngine(fakeEmitter, { someEvent: () => { callCount++; return null; } });
  engine.shutdown();
  fakeEmitter.emit('someEvent', {});
  assert.equal(callCount, 0); // handler was removed
});
