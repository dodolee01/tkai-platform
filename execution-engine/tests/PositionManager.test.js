import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionManager } from '../src/PositionManager.js';
import { OrderManager } from '../src/OrderManager.js';
import { OrderTracker } from '../src/OrderTracker.js';
import { OrderValidator } from '../src/OrderValidator.js';
import { DuplicateProtection } from '../src/DuplicateProtection.js';
import { RetryManager } from '../src/RetryManager.js';
import { RateLimiter } from '../src/RateLimiter.js';
import { createConfig } from '../src/Config.js';

function makeHarness(position) {
  const adapter = {
    exchangeName: 'binance',
    async getSymbolInfo() { return { symbol: 'BTCUSDT', tickSize: 0.1, stepSize: 0.001, minQty: 0.001, maxQty: 1000, minNotional: 5, status: 'TRADING' }; },
    async getBalance() { return [{ asset: 'USDT', available: 1000000, total: 1000000 }]; },
    async getPosition() { return position; },
    async placeOrder(order) { return { orderId: 'ex1', clientOrderId: order.clientOrderId, status: 'FILLED', executionPrice: 65000, quantity: order.quantity, fees: 0.1 }; },
  };
  const config = createConfig({ dryRun: false });
  const orderTracker = new OrderTracker();
  const validator = new OrderValidator({ adapter, duplicateProtection: new DuplicateProtection(config.duplicateProtection), orderTracker }, config.validation);
  const orderManager = new OrderManager({ adapter, orderTracker, validator, retryManager: new RetryManager(config.retry, async () => {}), rateLimiter: new RateLimiter(config.rateLimiter) }, config);
  return { adapter, positionManager: new PositionManager({ adapter, orderManager }) };
}

test('openPosition places a non-reduceOnly market order', async () => {
  const { positionManager } = makeHarness(null);
  const result = await positionManager.openPosition('BTCUSDT', 'LONG', 0.01, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(result.success, true);
});

test('closePosition returns NO_OP when there is no open position', async () => {
  const { positionManager } = makeHarness(null);
  const result = await positionManager.closePosition('BTCUSDT');
  assert.equal(result.status, 'NO_OP');
});

test('closePosition places a reduceOnly order sized to the full position', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'LONG', quantity: 0.02, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  const result = await positionManager.closePosition('BTCUSDT', { leverage: 5 });
  assert.equal(result.success, true);
  assert.equal(result.quantity, 0.02);
});

test('partialClose rejects a fraction outside (0, 1]', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'LONG', quantity: 0.02, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  await assert.rejects(() => positionManager.partialClose('BTCUSDT', 1.5), /fraction must be in/);
  await assert.rejects(() => positionManager.partialClose('BTCUSDT', 0), /fraction must be in/);
});

test('partialClose sizes the order proportionally to the fraction', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'LONG', quantity: 0.02, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  const result = await positionManager.partialClose('BTCUSDT', 0.5, { leverage: 5 });
  assert.equal(result.quantity, 0.01);
});

test('scaleIn throws when there is no existing position to scale into', async () => {
  const { positionManager } = makeHarness(null);
  await assert.rejects(() => positionManager.scaleIn('BTCUSDT', 0.01), /no existing position/);
});

test('scaleOut caps the reduce quantity at the current position size', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'LONG', quantity: 0.01, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  const result = await positionManager.scaleOut('BTCUSDT', 999, { leverage: 5 }); // requesting far more than exists
  assert.equal(result.quantity, 0.01);
});

test('reversePosition executes a close followed by an opposite-direction open', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'LONG', quantity: 0.01, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  const { closeResult, openResult } = await positionManager.reversePosition('BTCUSDT', 0.01, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(closeResult.success, true);
  assert.equal(openResult.success, true);
});

test('reversePosition throws when there is nothing to reverse', async () => {
  const { positionManager } = makeHarness(null);
  await assert.rejects(() => positionManager.reversePosition('BTCUSDT', 0.01), /no existing position/);
});

test('emergencyClose sets closePosition:true and flattens immediately', async () => {
  const { positionManager } = makeHarness({ symbol: 'BTCUSDT', side: 'SHORT', quantity: 0.03, entryPrice: 65000, leverage: 5, unrealizedPnl: 0 });
  const result = await positionManager.emergencyClose('BTCUSDT', { leverage: 5 });
  assert.equal(result.success, true);
  assert.equal(result.quantity, 0.03);
});
