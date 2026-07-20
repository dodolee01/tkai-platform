import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/TradeStore.js';
import { InMemoryPersistenceAdapter, PocketBasePersistenceAdapter } from '../src/Persistence.js';

function sampleTrade(overrides = {}) {
  return {
    symbol: 'BTCUSDT', timeframe: '15m', entryPrice: 100, exitPrice: 105, stopLoss: 95, takeProfit: 110,
    side: 'LONG', leverage: 3, quantity: 1, pnl: 5, pnlPercent: 0.05, fees: 0.1, confidence: 0.7,
    marketState: 'TRENDING', trendStrength: 0.5, volatility: 0.02, riskScore: 20, rrRatio: 2,
    executionTime: 1000, decision: 'LONG', bullishSignals: [], bearishSignals: [], scoreBreakdown: {}, indicatorSnapshot: {},
    ...overrides,
  };
}

test('recordTrade persists and caches a valid trade', async () => {
  const store = new TradeStore();
  const stored = await store.recordTrade(sampleTrade());
  assert.equal(store.size, 1);
  assert.equal(typeof stored.id, 'string');
});

test('recordTrade rejects a trade missing required fields', async () => {
  const store = new TradeStore();
  await assert.rejects(() => store.recordTrade({ symbol: 'X' }), /missing required field/);
});

test('hydrate loads pre-existing trades from persistence into the cache', async () => {
  const adapter = new InMemoryPersistenceAdapter();
  await adapter.save(sampleTrade());
  await adapter.save(sampleTrade());
  const store = new TradeStore({ persistenceAdapter: adapter });
  assert.equal(store.isHydrated, false);
  await store.hydrate();
  assert.equal(store.isHydrated, true);
  assert.equal(store.size, 2);
});

test('getAllTrades returns a defensive copy', async () => {
  const store = new TradeStore();
  await store.recordTrade(sampleTrade());
  const trades = store.getAllTrades();
  trades.push(sampleTrade());
  assert.equal(store.size, 1); // mutation of the returned array did not affect internal state
});

test('TradeStore exposes no update or delete method (append-only enforcement)', () => {
  const store = new TradeStore();
  assert.equal(typeof store.updateTrade, 'undefined');
  assert.equal(typeof store.deleteTrade, 'undefined');
  assert.equal(typeof store.removeTrade, 'undefined');
});

test('PocketBasePersistenceAdapter round-trips through a fake PocketBase client', async () => {
  class FakeCollection {
    constructor() { this.records = []; }
    async create(data) { const r = { ...data, id: `pb_${this.records.length + 1}` }; this.records.push(r); return r; }
    async getFullList() { return this.records.slice(); }
    async getList() { return { totalItems: this.records.length }; }
  }
  class FakePocketBase {
    constructor() { this._c = new Map(); }
    collection(name) {
      if (!this._c.has(name)) this._c.set(name, new FakeCollection());
      return this._c.get(name);
    }
  }
  const adapter = new PocketBasePersistenceAdapter(new FakePocketBase(), 'trades');
  const store = new TradeStore({ persistenceAdapter: adapter });
  await store.recordTrade(sampleTrade());
  assert.equal(store.size, 1);
  assert.equal(await adapter.count(), 1);
});

test('PocketBasePersistenceAdapter throws without a valid client', () => {
  assert.throws(() => new PocketBasePersistenceAdapter(null));
  assert.throws(() => new PocketBasePersistenceAdapter({}));
});
