import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, ScannerEvents } from '../../../src/scanner/core/EventBus.js';

test('EventBus.safeEmit delivers payload to listeners', () => {
  const bus = new EventBus();
  let received = null;
  bus.on(ScannerEvents.PRICE_UPDATE, (p) => { received = p; });
  bus.safeEmit(ScannerEvents.PRICE_UPDATE, { symbol: 'BTCUSDT', price: 100 });
  assert.deepEqual(received, { symbol: 'BTCUSDT', price: 100 });
});

test('EventBus.safeEmit does not throw when a listener throws', () => {
  const bus = new EventBus();
  bus.on('x', () => { throw new Error('boom'); });
  assert.doesNotThrow(() => bus.safeEmit('x', {}));
});

test('EventBus.safeEmit returns whether there were listeners', () => {
  const bus = new EventBus();
  assert.equal(bus.safeEmit('nobody-listening'), false);
  bus.on('somebody-listening', () => {});
  assert.equal(bus.safeEmit('somebody-listening'), true);
});

test('EventBus.waitFor resolves when the event fires', async () => {
  const bus = new EventBus();
  const promise = bus.waitFor('ready', 1000);
  bus.emit('ready', { ok: true });
  const result = await promise;
  assert.deepEqual(result, { ok: true });
});

test('EventBus.waitFor rejects on timeout', async () => {
  const bus = new EventBus();
  await assert.rejects(() => bus.waitFor('never', 20));
});

test('ScannerEvents is frozen and covers required event names', () => {
  assert.ok(Object.isFrozen(ScannerEvents));
  for (const key of ['PRICE_UPDATE', 'ORDERBOOK_UPDATE', 'WORKER_ONLINE', 'STREAM_RECONNECTING', 'HEALTH_CRITICAL']) {
    assert.ok(key in ScannerEvents);
  }
});
