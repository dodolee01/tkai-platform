import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffPosition, PositionSynchronizer } from '../src/PositionSynchronizer.js';
import { createConfig } from '../src/Config.js';

const local = { id: 'p1', symbol: 'BTCUSDT', remainingQuantity: 1, leverage: 5, averageEntryPrice: 100 };

test('detects manual_close when the exchange reports no position', () => {
  assert.equal(diffPosition(local, null).type, 'manual_close');
  assert.equal(diffPosition(local, { side: 'FLAT', quantity: 0 }).type, 'manual_close');
});

test('detects manual_reduction when exchange quantity is smaller than tracked', () => {
  const diff = diffPosition(local, { side: 'LONG', quantity: 0.5, leverage: 5, entryPrice: 100 });
  assert.equal(diff.type, 'manual_reduction');
  assert.equal(diff.details.reducedBy, 0.5);
});

test('detects manual_leverage_change when leverage differs but quantity matches', () => {
  const diff = diffPosition(local, { side: 'LONG', quantity: 1, leverage: 10, entryPrice: 100 });
  assert.equal(diff.type, 'manual_leverage_change');
});

test('detects manual_margin_change when entry price shifts with unchanged quantity/leverage', () => {
  const diff = diffPosition(local, { side: 'LONG', quantity: 1, leverage: 5, entryPrice: 105 });
  assert.equal(diff.type, 'manual_margin_change');
});

test('reports no_change when everything matches within tolerance', () => {
  assert.equal(diffPosition(local, { side: 'LONG', quantity: 1, leverage: 5, entryPrice: 100 }).type, 'no_change');
});

test('constructor requires a fetchExchangePosition function', () => {
  assert.throws(() => new PositionSynchronizer({}, createConfig().synchronizer));
});

test('syncPosition uses the injected fetch function, never a real network call', async () => {
  let called = 0;
  const sync = new PositionSynchronizer({ fetchExchangePosition: async () => { called++; return null; } }, createConfig().synchronizer);
  const diff = await sync.syncPosition(local);
  assert.equal(called, 1);
  assert.equal(diff.type, 'manual_close');
});

test('syncAll filters out unchanged positions, returning only real differences', async () => {
  const sync = new PositionSynchronizer(
    { fetchExchangePosition: async (symbol) => (symbol === 'BTCUSDT' ? null : { side: 'LONG', quantity: 2, leverage: 5, entryPrice: 200 }) },
    createConfig().synchronizer
  );
  const unchanged = { id: 'p2', symbol: 'ETHUSDT', remainingQuantity: 2, leverage: 5, averageEntryPrice: 200 };
  const diffs = await sync.syncAll([local, unchanged]);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].positionId, 'p1');
});
