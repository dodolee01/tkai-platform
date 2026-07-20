import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionEngine } from '../src/PositionEngine.js';
import { PositionEvents } from '../src/EventPublisher.js';
import { PositionState } from '../src/PositionStateMachine.js';

function openInput(overrides = {}) {
  return { symbol: 'BTCUSDT', userId: 'u1', exchange: 'binance', side: 'LONG', entryPrice: 65000, quantity: 0.1, leverage: 5, stopLoss: 64000, takeProfit: 70000, ...overrides };
}

test('openPosition + initialize wire correctly end to end', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const position = await engine.openPosition(openInput());
  assert.equal(position.state, PositionState.OPEN);
});

test('break-even activates at the configured R-multiple and preserves the true initial risk for later trailing math', async () => {
  const engine = new PositionEngine({}, { breakEven: { method: 'riskMultiple', riskMultipleTrigger: 1.0 }, trailing: { method: 'percentage', activationRR: 1.5 } });
  await engine.initialize();
  const position = await engine.openPosition(openInput());

  const events = [];
  engine.eventPublisher.on(PositionEvents.BREAK_EVEN_ACTIVATED, () => events.push('be'));
  engine.eventPublisher.on(PositionEvents.TRAILING_UPDATED, () => events.push('trail'));

  const afterBE = await engine.updateMarkPrice(position.id, 66100); // 1.1R -> break-even triggers
  assert.equal(afterBE.breakEvenActivated, true);
  assert.equal(afterBE.initialStopLoss, 64000); // untouched despite stopLoss moving

  const afterTrail = await engine.updateMarkPrice(position.id, 68000); // 3R off the TRUE initial risk -> trailing activates
  assert.equal(afterTrail.trailingActive, true);
  assert.equal(afterTrail.state, PositionState.TRAILING);
  assert.deepEqual(events, ['be', 'trail']);
});

test('takeProfitHit and stopLossHit fire when price crosses those levels', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const position = await engine.openPosition(openInput());
  const events = [];
  engine.eventPublisher.on(PositionEvents.TAKE_PROFIT_HIT, () => events.push('tp'));
  engine.eventPublisher.on(PositionEvents.STOP_LOSS_HIT, () => events.push('sl'));

  await engine.updateMarkPrice(position.id, 70000); // hits takeProfit
  assert.ok(events.includes('tp'));

  const position2 = await engine.openPosition(openInput({ symbol: 'ETHUSDT' }));
  await engine.updateMarkPrice(position2.id, 64000); // hits stopLoss
  assert.ok(events.includes('sl'));
});

test('partialClose with a preset percentage recalculates remaining quantity and realized PnL', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const position = await engine.openPosition(openInput());
  const result = await engine.partialClose(position.id, { presetPercent: 25, closePrice: 66000 });
  assert.ok(Math.abs(result.remainingQuantity - 0.075) < 1e-9);
  assert.equal(result.realizedPnl, (66000 - 65000) * 0.025);
});

test('partialClose with fraction:1.0 fully closes the position', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const position = await engine.openPosition(openInput());
  const result = await engine.partialClose(position.id, { fraction: 1.0, closePrice: 66000 });
  assert.equal(result.state, PositionState.CLOSED);
});

test('getStatistics aggregates only closed/archived positions for the given user', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const p1 = await engine.openPosition(openInput({ userId: 'u1' }));
  await engine.openPosition(openInput({ userId: 'u2', symbol: 'ETHUSDT' })); // stays open, should be excluded
  await engine.partialClose(p1.id, { fraction: 1.0, closePrice: 67000 });

  const stats = engine.getStatistics('u1');
  assert.equal(stats.totalTrades, 1);
  assert.equal(stats.winRate, 1);
});

test('recordEquity and getDrawdownReport integrate correctly', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  engine.recordEquity(10000);
  engine.recordEquity(9000);
  const report = engine.getDrawdownReport();
  assert.ok(report.currentDrawdownPct > 0);
});

test('getExposureReport reflects currently open positions', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  const position = await engine.openPosition(openInput());
  await engine.updateMarkPrice(position.id, 65000);
  const report = engine.getExposureReport(10000);
  assert.ok(report.symbolExposurePct.BTCUSDT > 0);
});

test('syncAll throws a clear error when no fetchExchangePosition was supplied', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  await assert.rejects(() => engine.syncAll(), /no fetchExchangePosition dependency/);
});

test('syncAll works end to end when a fetch function is supplied', async () => {
  const engine = new PositionEngine({ fetchExchangePosition: async () => null });
  await engine.initialize();
  await engine.openPosition(openInput());
  const diffs = await engine.syncAll();
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].type, 'manual_close');
});

test('multi-symbol, multi-user support works correctly across the whole engine', async () => {
  const engine = new PositionEngine();
  await engine.initialize();
  await engine.openPosition(openInput({ userId: 'alice', symbol: 'BTCUSDT', side: 'LONG' }));
  await engine.openPosition(openInput({ userId: 'bob', symbol: 'ETHUSDT', side: 'SHORT', entryPrice: 3000, stopLoss: 3100 }));
  assert.equal(engine.positionManager.getOpenPositions('alice').length, 1);
  assert.equal(engine.positionManager.getOpenPositions('bob').length, 1);
  assert.equal(engine.positionManager.getOpenPositions().length, 2);
});
