import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderTracker, OrderStatus } from '../src/OrderTracker.js';

function req(overrides = {}) {
  return { symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 0.01, clientOrderId: 'o1', ...overrides };
}

test('createPending starts an order in PENDING state', () => {
  const tracker = new OrderTracker();
  tracker.createPending(req());
  assert.equal(tracker.get('o1').status, OrderStatus.PENDING);
});

test('valid transitions succeed and update fields', () => {
  const tracker = new OrderTracker();
  tracker.createPending(req());
  tracker.updateStatus('o1', OrderStatus.ACCEPTED, { orderId: 'ex1' });
  tracker.updateStatus('o1', OrderStatus.FILLED, { executionPrice: 100, filledQuantity: 0.01 });
  const order = tracker.get('o1');
  assert.equal(order.status, OrderStatus.FILLED);
  assert.equal(order.orderId, 'ex1');
  assert.equal(order.executionPrice, 100);
});

test('invalid transitions throw and do not mutate state', () => {
  const tracker = new OrderTracker();
  tracker.createPending(req());
  tracker.updateStatus('o1', OrderStatus.REJECTED, {});
  assert.throws(() => tracker.updateStatus('o1', OrderStatus.FILLED, {}));
  assert.equal(tracker.get('o1').status, OrderStatus.REJECTED);
});

test('updateStatus on an unknown clientOrderId throws', () => {
  const tracker = new OrderTracker();
  assert.throws(() => tracker.updateStatus('never-existed', OrderStatus.ACCEPTED, {}));
});

test('statusHistory records every transition in order', () => {
  const tracker = new OrderTracker();
  tracker.createPending(req());
  tracker.updateStatus('o1', OrderStatus.ACCEPTED, {});
  tracker.updateStatus('o1', OrderStatus.PARTIALLY_FILLED, {});
  tracker.updateStatus('o1', OrderStatus.FILLED, {});
  const history = tracker.get('o1').statusHistory.map((h) => h.status);
  assert.deepEqual(history, [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED]);
});

test('getActiveBySymbol excludes terminal-state orders', () => {
  const tracker = new OrderTracker();
  tracker.createPending(req({ clientOrderId: 'a' }));
  tracker.createPending(req({ clientOrderId: 'b' }));
  tracker.updateStatus('a', OrderStatus.ACCEPTED, {});
  tracker.updateStatus('a', OrderStatus.FILLED, {});
  const active = tracker.getActiveBySymbol('BTCUSDT');
  assert.equal(active.length, 1);
  assert.equal(active[0].clientOrderId, 'b');
});
