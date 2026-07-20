import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionManager } from '../src/PositionManager.js';
import { InMemoryPositionRepository } from '../src/PositionRepository.js';
import { EventPublisher, PositionEvents } from '../src/EventPublisher.js';
import { PositionState } from '../src/PositionStateMachine.js';
import { createConfig } from '../src/Config.js';

function makeHarness() {
  const repository = new InMemoryPositionRepository();
  const eventPublisher = new EventPublisher();
  const events = [];
  Object.values(PositionEvents).forEach((e) => eventPublisher.on(e, () => events.push(e)));
  const manager = new PositionManager({ repository, eventPublisher }, createConfig());
  return { manager, repository, events };
}

function openInput(overrides = {}) {
  return { symbol: 'BTCUSDT', userId: 'u1', exchange: 'binance', side: 'LONG', entryPrice: 65000, quantity: 0.1, leverage: 5, stopLoss: 64000, ...overrides };
}

test('openPosition creates a position directly in the OPEN state with computed margin/liquidation fields', async () => {
  const { manager } = makeHarness();
  const position = await manager.openPosition(openInput());
  assert.equal(position.state, PositionState.OPEN);
  assert.equal(position.initialMargin, (65000 * 0.1) / 5);
  assert.ok(position.liquidationPrice < 65000);
  assert.equal(position.initialStopLoss, 64000);
});

test('openPosition emits positionOpened and persists to the repository', async () => {
  const { manager, repository, events } = makeHarness();
  const position = await manager.openPosition(openInput());
  assert.ok(events.includes(PositionEvents.POSITION_OPENED));
  assert.ok(await repository.getById(position.id));
});

test('updateMarkPrice recomputes unrealizedPnl, ROI, and margin ratio', async () => {
  const { manager } = makeHarness();
  const position = await manager.openPosition(openInput());
  const updated = await manager.updateMarkPrice(position.id, 66000);
  assert.equal(updated.unrealizedPnl, (66000 - 65000) * 0.1);
  assert.ok(updated.roi !== 0);
});

test('updateMarkPrice emits positionLiquidated when the liquidation price is breached', async () => {
  const { manager, events } = makeHarness();
  const position = await manager.openPosition(openInput({ leverage: 20, stopLoss: null }));
  await manager.updateMarkPrice(position.id, position.liquidationPrice - 1);
  assert.ok(events.includes(PositionEvents.POSITION_LIQUIDATED));
});

test('reducePosition partially closes and moves to PARTIALLY_CLOSED', async () => {
  const { manager, events } = makeHarness();
  const position = await manager.openPosition(openInput());
  const reduced = await manager.reducePosition(position.id, 0.05, 50, 66000);
  assert.equal(reduced.remainingQuantity, 0.05);
  assert.equal(reduced.realizedPnl, 50);
  assert.equal(reduced.state, PositionState.PARTIALLY_CLOSED);
  assert.ok(events.includes(PositionEvents.POSITION_REDUCED));
});

test('reducePosition to zero fully closes and emits positionClosed', async () => {
  const { manager, events } = makeHarness();
  const position = await manager.openPosition(openInput());
  const closed = await manager.reducePosition(position.id, 0.1, 100, 66000);
  assert.equal(closed.state, PositionState.CLOSED);
  assert.ok(closed.closedAt !== null);
  assert.ok(events.includes(PositionEvents.POSITION_CLOSED));
});

test('archivePosition transitions CLOSED -> ARCHIVED', async () => {
  const { manager } = makeHarness();
  const position = await manager.openPosition(openInput());
  await manager.reducePosition(position.id, 0.1, 100, 66000);
  const archived = await manager.archivePosition(position.id);
  assert.equal(archived.state, PositionState.ARCHIVED);
});

test('applyPatch updates arbitrary fields and emits positionUpdated', async () => {
  const { manager, events } = makeHarness();
  const position = await manager.openPosition(openInput());
  const patched = await manager.applyPatch(position.id, { breakEvenActivated: true });
  assert.equal(patched.breakEvenActivated, true);
  assert.ok(events.includes(PositionEvents.POSITION_UPDATED));
});

test('getOpenPositions filters by live state and optionally by user', async () => {
  const { manager } = makeHarness();
  const p1 = await manager.openPosition(openInput({ userId: 'u1' }));
  await manager.openPosition(openInput({ userId: 'u2', symbol: 'ETHUSDT' }));
  await manager.reducePosition(p1.id, 0.1, 10, 66000); // fully closes p1
  const open = manager.getOpenPositions();
  assert.equal(open.length, 1);
  assert.equal(open[0].symbol, 'ETHUSDT');
});

test('hydrate loads prior positions from the repository into a fresh manager', async () => {
  const { manager, repository } = makeHarness();
  await manager.openPosition(openInput());
  const fresh = new PositionManager({ repository, eventPublisher: new EventPublisher() }, createConfig());
  await fresh.hydrate();
  assert.equal(fresh.getAll().length, 1);
});

test('operating on an unknown position id throws a clear error', async () => {
  const { manager } = makeHarness();
  await assert.rejects(() => manager.updateMarkPrice('never-existed', 100), /no position with id/);
});
