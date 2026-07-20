import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderManager } from '../src/OrderManager.js';
import { OrderTracker, OrderStatus } from '../src/OrderTracker.js';
import { OrderValidator } from '../src/OrderValidator.js';
import { DuplicateProtection } from '../src/DuplicateProtection.js';
import { RetryManager } from '../src/RetryManager.js';
import { RateLimiter } from '../src/RateLimiter.js';
import { createConfig } from '../src/Config.js';

function makeAdapter(overrides = {}) {
  return {
    exchangeName: 'binance',
    async getSymbolInfo() { return { symbol: 'BTCUSDT', tickSize: 0.1, stepSize: 0.001, minQty: 0.001, maxQty: 1000, minNotional: 5, status: 'TRADING' }; },
    async getBalance() { return [{ asset: 'USDT', available: 100000, total: 100000 }]; },
    async placeOrder(order) { return { orderId: 'ex1', clientOrderId: order.clientOrderId, status: 'NEW', executionPrice: order.price ?? 65000, quantity: order.quantity, fees: 0.1 }; },
    async cancelOrder(symbol, orderId) { return { orderId, status: 'CANCELED' }; },
    ...overrides,
  };
}

function makeManager(config, adapterOverrides = {}) {
  const adapter = makeAdapter(adapterOverrides);
  const orderTracker = new OrderTracker();
  const validator = new OrderValidator({ adapter, duplicateProtection: new DuplicateProtection(config.duplicateProtection), orderTracker }, config.validation);
  return new OrderManager({ adapter, orderTracker, validator, retryManager: new RetryManager(config.retry, async () => {}), rateLimiter: new RateLimiter(config.rateLimiter) }, config);
}

test('order builders produce the correct type and default flags', () => {
  const mgr = makeManager(createConfig());
  assert.equal(mgr.buildMarketOrder('BTCUSDT', 'BUY', 1).type, 'MARKET');
  assert.equal(mgr.buildStopMarketOrder('BTCUSDT', 'SELL', 1, 100).reduceOnly, true);
  assert.equal(mgr.buildLimitOrder('BTCUSDT', 'BUY', 1, 100, { postOnly: true }).timeInForce, 'GTX');
  assert.equal(mgr.buildTrailingStopOrder('BTCUSDT', 'SELL', 1, 2).type, 'TRAILING_STOP_MARKET');
});

test('withTimeInForce overrides IOC/FOK on a built order', () => {
  const mgr = makeManager(createConfig());
  const order = mgr.buildLimitOrder('BTCUSDT', 'BUY', 1, 100);
  assert.equal(mgr.withTimeInForce(order, 'FOK').timeInForce, 'FOK');
});

test('each generated order has a unique clientOrderId', () => {
  const mgr = makeManager(createConfig());
  const a = mgr.buildMarketOrder('BTCUSDT', 'BUY', 1);
  const b = mgr.buildMarketOrder('BTCUSDT', 'BUY', 1);
  assert.notEqual(a.clientOrderId, b.clientOrderId);
});

test('dryRun submission never calls adapter.placeOrder but returns a full FILLED result', async () => {
  let placeOrderCalled = false;
  const config = createConfig({ dryRun: true });
  const mgr = makeManager(config, { placeOrder: async () => { placeOrderCalled = true; } });
  const order = mgr.buildMarketOrder('BTCUSDT', 'BUY', 0.01);
  const result = await mgr.submitOrder(order, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(placeOrderCalled, false);
  assert.equal(result.success, true);
  assert.equal(result.status, OrderStatus.FILLED);
});

test('live submission calls the adapter and returns its exchange orderId', async () => {
  const config = createConfig({ dryRun: false });
  const mgr = makeManager(config);
  const order = mgr.buildMarketOrder('BTCUSDT', 'BUY', 0.01);
  const result = await mgr.submitOrder(order, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(result.orderId, 'ex1');
});

test('an order failing validation is rejected before ever reaching the adapter', async () => {
  let placeOrderCalled = false;
  const config = createConfig({ dryRun: false });
  const mgr = makeManager(config, { placeOrder: async () => { placeOrderCalled = true; } });
  const order = mgr.buildMarketOrder('BTCUSDT', 'BUY', 0.0000001);
  const result = await mgr.submitOrder(order, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(result.success, false);
  assert.equal(result.status, OrderStatus.REJECTED);
  assert.equal(placeOrderCalled, false);
});

test('a non-retryable exchange rejection surfaces with its reason', async () => {
  const config = createConfig({ dryRun: false });
  const mgr = makeManager(config, { placeOrder: async () => { throw { code: -2019, msg: 'Margin is insufficient.' }; } });
  const order = mgr.buildMarketOrder('BTCUSDT', 'BUY', 0.01);
  const result = await mgr.submitOrder(order, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(result.success, false);
  assert.ok(result.rejectReason.includes('insufficient'));
});

test('output shape matches the required OrderResult contract exactly', async () => {
  const config = createConfig({ dryRun: false });
  const mgr = makeManager(config);
  const order = mgr.buildMarketOrder('BTCUSDT', 'BUY', 0.01);
  const result = await mgr.submitOrder(order, { leverage: 5, estimatedReferencePrice: 65000 });
  for (const key of ['success', 'orderId', 'clientOrderId', 'executionPrice', 'quantity', 'fees', 'status', 'exchange', 'latency', 'timestamp']) {
    assert.ok(key in result, `missing ${key}`);
  }
});

test('cancelOrder respects dryRun and calls the adapter otherwise', async () => {
  const dryMgr = makeManager(createConfig({ dryRun: true }));
  const dryResult = await dryMgr.cancelOrder('BTCUSDT', 'ex1');
  assert.equal(dryResult.status, OrderStatus.CANCELLED);

  const liveMgr = makeManager(createConfig({ dryRun: false }));
  const liveResult = await liveMgr.cancelOrder('BTCUSDT', 'ex1');
  assert.equal(liveResult.status, 'CANCELED');
});
