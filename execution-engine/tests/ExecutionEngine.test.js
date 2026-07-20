import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionEngine } from '../src/ExecutionEngine.js';

function makeAdapter() {
  const orders = [];
  let leverage = 1;
  return {
    exchangeName: 'binance',
    orders,
    async getSymbolInfo() { return { tickSize: 0.1, stepSize: 0.001, minQty: 0.001, maxQty: 1000, minNotional: 5, maxLeverage: 50, status: 'TRADING' }; },
    async getBalance() { return [{ asset: 'USDT', available: 1000000, total: 1000000 }]; },
    async getPosition() { return null; },
    async setLeverage(symbol, lev) { leverage = lev; return { symbol, leverage: lev }; },
    async getLeverage() { return leverage; },
    async placeOrder(order) {
      orders.push(order);
      return { orderId: `ex_${orders.length}`, clientOrderId: order.clientOrderId, status: 'FILLED', executionPrice: order.price ?? order.stopPrice ?? 65000, quantity: order.quantity, fees: 0.1 };
    },
  };
}

function basePlan(overrides = {}) {
  return {
    symbol: 'BTCUSDT', side: 'LONG', positionSize: 200, leverage: 5, stopLoss: 64000,
    takeProfit: 67000, breakEven: true, trailingStop: true, allowed: true, entryPrice: 65000,
    ...overrides,
  };
}

test('allowed:false does absolutely nothing', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const result = await engine.execute(basePlan({ allowed: false }));
  assert.equal(result.status, 'NO_OP');
  assert.equal(adapter.orders.length, 0);
});

test('allowed:true places entry, stop-loss, and take-profit orders', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const result = await engine.execute(basePlan());
  assert.equal(result.success, true);
  assert.equal(adapter.orders.length, 3);
  assert.equal(adapter.orders[0].type, 'MARKET');
  assert.equal(adapter.orders[1].type, 'STOP_MARKET');
  assert.equal(adapter.orders[2].type, 'TAKE_PROFIT_MARKET');
});

test('output matches the exact required OrderResult contract', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const result = await engine.execute(basePlan());
  for (const key of ['success', 'orderId', 'clientOrderId', 'executionPrice', 'quantity', 'fees', 'status', 'exchange', 'latency', 'timestamp']) {
    assert.ok(key in result, `missing ${key}`);
  }
});

test('multi-target takeProfit array is split proportionally by sizePct', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  // positionSize chosen large enough that step-size rounding (0.001 BTC)
  // doesn't collapse the two distinct sizePct fractions into equal quantities.
  await engine.execute(basePlan({ positionSize: 200000, takeProfit: [{ price: 66000, sizePct: 0.6 }, { price: 67000, sizePct: 0.4 }] }));
  assert.equal(adapter.orders.length, 4); // entry + SL + 2 TP
  const tp1 = adapter.orders[2];
  const tp2 = adapter.orders[3];
  assert.ok(Math.abs(tp1.quantity / tp2.quantity - 0.6 / 0.4) < 1e-3);
});

test('duplicate plans within the idempotency window are blocked', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const plan = basePlan();
  await engine.execute(plan);
  const secondResult = await engine.execute(plan);
  assert.equal(secondResult.status, 'NO_OP');
  assert.ok(secondResult.rejectReason.includes('duplicate'));
});

test('an engaged kill switch blocks execution and touches nothing', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  engine.killSwitch.engage('test halt');
  const result = await engine.execute(basePlan());
  assert.equal(result.status, 'NO_OP');
  assert.equal(adapter.orders.length, 0);
});

test('dryRun (the default) never calls the real adapter but returns a full simulated fill', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }); // dryRun defaults to true
  const result = await engine.execute(basePlan({ symbol: 'ETHUSDT' }));
  assert.equal(adapter.orders.length, 0);
  assert.equal(result.success, true);
  assert.equal(result.status, 'FILLED');
});

test('invalid leverage blocks the entire execution before any order is placed', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const result = await engine.execute(basePlan({ leverage: 99999 }));
  assert.ok(result.rejectReason.includes('leverage_rejected'));
  assert.equal(adapter.orders.length, 0);
});

test('same-symbol concurrent execute() calls are serialized by the execution queue', async () => {
  const adapter = makeAdapter();
  const engine = new ExecutionEngine({ adapter }, { dryRun: false });
  const planA = basePlan({ positionSize: 100 });
  const planB = basePlan({ positionSize: 150 }); // different economic terms -> different idempotency key, so not blocked as duplicate
  const [resultA, resultB] = await Promise.all([engine.execute(planA), engine.execute(planB)]);
  assert.equal(resultA.success, true);
  assert.equal(resultB.success, true);
  assert.equal(adapter.orders.length, 6); // 3 orders each
});

test('a repeated execution failure trips the kill switch automatically', async () => {
  const adapter = makeAdapter();
  adapter.getSymbolInfo = async () => { throw new Error('network failure'); };
  const engine = new ExecutionEngine({ adapter }, { dryRun: false, killSwitch: { autoEngageOnConsecutiveErrors: 2, autoEngageWindowMs: 60000 } });
  await engine.execute(basePlan({ symbol: 'A' }));
  await engine.execute(basePlan({ symbol: 'B' }));
  assert.equal(engine.killSwitch.isEngaged(), true);
});
