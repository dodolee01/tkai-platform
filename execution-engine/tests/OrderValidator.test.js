import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderValidator } from '../src/OrderValidator.js';
import { DuplicateProtection } from '../src/DuplicateProtection.js';
import { OrderTracker } from '../src/OrderTracker.js';
import { createConfig } from '../src/Config.js';

function makeAdapter(overrides = {}) {
  return {
    async getSymbolInfo() {
      return { symbol: 'BTCUSDT', tickSize: 0.1, stepSize: 0.001, minQty: 0.001, maxQty: 1000, minNotional: 5, status: 'TRADING', ...overrides.symbolInfo };
    },
    async getBalance() {
      return overrides.balance ?? [{ asset: 'USDT', available: 10000, total: 10000 }];
    },
  };
}

function makeValidator(adapterOverrides = {}) {
  const orderTracker = new OrderTracker();
  const dupProtection = new DuplicateProtection({ idempotencyTtlMs: 60000 });
  return new OrderValidator({ adapter: makeAdapter(adapterOverrides), duplicateProtection: dupProtection, orderTracker }, createConfig().validation);
}

test('a well-formed order within all limits validates successfully', async () => {
  const validator = makeValidator();
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.01, price: 65000, clientOrderId: 'x' }, { leverage: 5 });
  assert.equal(result.valid, true);
});

test('rejects when the market is not TRADING', async () => {
  const validator = makeValidator({ symbolInfo: { status: 'BREAK' } });
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.01, price: 65000, clientOrderId: 'x' }, { leverage: 5 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('market_not_open')));
});

test('rounds price and quantity to valid tick/step size', async () => {
  const validator = makeValidator();
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.0129, price: 65000.28, clientOrderId: 'x' }, { leverage: 5 });
  assert.equal(result.normalizedOrder.price, 65000.2);
  assert.equal(result.normalizedOrder.quantity, 0.012);
});

test('rejects a quantity below the exchange minimum', async () => {
  const validator = makeValidator();
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.0001, price: 65000, clientOrderId: 'x' }, { leverage: 5 });
  assert.equal(result.valid, false);
});

test('rejects an order below minimum notional', async () => {
  const validator = makeValidator();
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.001, price: 100, clientOrderId: 'x' }, { leverage: 5 });
  assert.ok(result.errors.some((e) => e.includes('below_minimum_notional')));
});

test('reduceOnly without an existing position is rejected', async () => {
  const validator = makeValidator();
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'SELL', type: 'MARKET', quantity: 0.01, reduceOnly: true, clientOrderId: 'x' }, { estimatedReferencePrice: 65000 });
  assert.ok(result.errors.includes('reduce_only_without_position'));
});

test('reduceOnly exceeding position size is rejected', async () => {
  const validator = makeValidator();
  const result = await validator.validate(
    { symbol: 'BTCUSDT', side: 'SELL', type: 'MARKET', quantity: 0.02, reduceOnly: true, clientOrderId: 'x' },
    { existingPosition: { quantity: 0.01 }, estimatedReferencePrice: 65000 }
  );
  assert.ok(result.errors.includes('reduce_only_exceeds_position_size'));
});

test('insufficient margin is detected against available balance and leverage', async () => {
  const validator = makeValidator({ balance: [{ asset: 'USDT', available: 10, total: 10 }] });
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 1, clientOrderId: 'x' }, { leverage: 1, estimatedReferencePrice: 65000 });
  assert.ok(result.errors.includes('insufficient_margin'));
});

test('a clientOrderId already present in the tracker is flagged as a duplicate', async () => {
  const orderTracker = new OrderTracker();
  orderTracker.createPending({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 0.01, clientOrderId: 'dup' });
  const validator = new OrderValidator(
    { adapter: makeAdapter(), duplicateProtection: new DuplicateProtection({ idempotencyTtlMs: 60000 }), orderTracker },
    createConfig().validation
  );
  const result = await validator.validate({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 0.01, clientOrderId: 'dup' }, { leverage: 5, estimatedReferencePrice: 65000 });
  assert.equal(result.valid, false);
});
