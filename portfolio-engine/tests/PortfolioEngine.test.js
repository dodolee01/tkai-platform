import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioEngine } from '../src/PortfolioEngine.js';
import { PortfolioEventNames } from '../src/PortfolioEvents.js';

function makePositionFetcher(positions) {
  return async () => positions;
}
function makeBalanceFetcher(balances) {
  return async () => balances;
}

test('initialize + registerAccount work without any injected sync sources', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  const account = engine.registerAccount('u1', 'binance', 'one-way');
  assert.equal(account.positionMode, 'one-way');
});

test('updateBalance persists, updates equity, and emits balanceChanged + equityChanged', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  const events = [];
  engine.eventPublisher.on(PortfolioEventNames.BALANCE_CHANGED, () => events.push('balance'));
  engine.eventPublisher.on(PortfolioEventNames.EQUITY_CHANGED, () => events.push('equity'));
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 5000, availableBalance: 5000, marginBalance: 5000, usedMargin: 0 });
  assert.deepEqual(events, ['balance', 'equity']);
  assert.equal(engine.getEquityReport('u1').currentEquity, 5000);
});

test('syncBalances pulls from the injected fetch function and applies each asset', async () => {
  const engine = new PortfolioEngine({ fetchExchangeBalances: makeBalanceFetcher([{ asset: 'USDT', walletBalance: 8000, availableBalance: 8000, marginBalance: 8000, usedMargin: 0 }]) });
  await engine.initialize();
  await engine.syncBalances('u1', 'binance');
  assert.equal(engine.getEquityReport('u1').currentEquity, 8000);
});

test('syncBalances throws a clear error without a fetchExchangeBalances dependency', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  await assert.rejects(() => engine.syncBalances('u1', 'binance'), /no fetchExchangeBalances dependency/);
});

test('syncPositions pulls from the injected fetch function and updates exposure', async () => {
  const positions = [{ id: 'p1', symbol: 'BTCUSDT', userId: 'u1', exchange: 'binance', side: 'LONG', remainingQuantity: 1, markPrice: 1000, unrealizedPnl: 0, realizedPnl: 0 }];
  const engine = new PortfolioEngine({ fetchPositions: makePositionFetcher(positions) });
  await engine.initialize();
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 10000, availableBalance: 10000, marginBalance: 10000, usedMargin: 0 });
  await engine.syncPositions('u1');
  assert.equal(engine.getExposureReport('u1').symbolExposure.BTCUSDT, 0.1);
});

test('syncPositions throws a clear error without a fetchPositions dependency', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  await assert.rejects(() => engine.syncPositions('u1'), /no fetchPositions dependency/);
});

test('recordClosedTrade updates performance and fires performanceUpdated', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  const events = [];
  engine.eventPublisher.on(PortfolioEventNames.PERFORMANCE_UPDATED, () => events.push('perf'));
  await engine.recordClosedTrade({ symbol: 'BTCUSDT', userId: 'u1', realizedPnl: 100, openedAt: Date.now() - 1000, closedAt: Date.now() });
  assert.ok(events.includes('perf'));
  assert.equal(engine.getPerformanceReport('u1').netProfit, 100);
});

test('every balance/position/trade update triggers a snapshotCreated event', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  let count = 0;
  engine.eventPublisher.on(PortfolioEventNames.SNAPSHOT_CREATED, () => count++);
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 1000, marginBalance: 1000, usedMargin: 0 });
  assert.ok(count >= 1);
});

test('takeSnapshot can be called manually for any granularity and returns a frozen record', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  const snap = await engine.takeSnapshot('monthly', 'u1');
  assert.equal(snap.granularity, 'monthly');
  assert.ok(Object.isFrozen(snap));
});

test('getCapitalReport reflects registered balances and open positions', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 10000, availableBalance: 7000, marginBalance: 10000, usedMargin: 3000 });
  const report = engine.getCapitalReport('u1');
  assert.ok(report.maxDeployableCapital > 0);
  assert.ok(report.availableCapital <= report.maxDeployableCapital);
});

test('multi-user isolation holds across the whole engine', async () => {
  const engine = new PortfolioEngine();
  await engine.initialize();
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'alice', walletBalance: 5000, availableBalance: 5000, marginBalance: 5000, usedMargin: 0 });
  await engine.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'bob', walletBalance: 9000, availableBalance: 9000, marginBalance: 9000, usedMargin: 0 });
  assert.equal(engine.getEquityReport('alice').currentEquity, 5000);
  assert.equal(engine.getEquityReport('bob').currentEquity, 9000);
});
