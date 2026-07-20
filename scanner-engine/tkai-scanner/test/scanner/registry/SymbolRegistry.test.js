import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SymbolRegistry, parseSymbolInfo } from '../../../src/scanner/registry/SymbolRegistry.js';

const fixtureSymbol = {
  symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING',
  contractType: 'PERPETUAL', pricePrecision: 2, quantityPrecision: 3,
  filters: [
    { filterType: 'PRICE_FILTER', tickSize: '0.10' },
    { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '1000' },
    { filterType: 'MARKET_LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '500' },
  ],
};

test('parseSymbolInfo extracts filter values correctly', () => {
  const parsed = parseSymbolInfo(fixtureSymbol);
  assert.equal(parsed.symbol, 'BTCUSDT');
  assert.equal(parsed.tickSize, 0.1);
  assert.equal(parsed.stepSize, 0.001);
  assert.equal(parsed.minQty, 0.001);
  assert.equal(parsed.maxQty, 1000);
  assert.equal(parsed.marketMaxQty, 500);
});

test('parseSymbolInfo tolerates missing filters', () => {
  const parsed = parseSymbolInfo({ ...fixtureSymbol, filters: [] });
  assert.equal(parsed.tickSize, null);
  assert.equal(parsed.stepSize, null);
});

test('SymbolRegistry.refresh keeps only TRADING PERPETUAL USDT symbols', async () => {
  const registry = new SymbolRegistry({
    fetchExchangeInfo: async () => ({
      symbols: [
        fixtureSymbol,
        { ...fixtureSymbol, symbol: 'ETHBUSD', quoteAsset: 'BUSD' },
        { ...fixtureSymbol, symbol: 'OLDUSDT', status: 'BREAK' },
        { ...fixtureSymbol, symbol: 'DELIVERYUSDT', contractType: 'CURRENT_QUARTER' },
      ],
    }),
    logger: null,
    eventBus: null,
  });
  await registry.refresh();
  assert.equal(registry.size, 1);
  assert.ok(registry.get('BTCUSDT'));
  assert.equal(registry.get('ETHBUSD'), undefined);
  assert.equal(registry.get('OLDUSDT'), undefined);
  assert.equal(registry.get('DELIVERYUSDT'), undefined);
});

test('SymbolRegistry.refresh emits registry:refreshed', async () => {
  let emitted = null;
  const registry = new SymbolRegistry({
    fetchExchangeInfo: async () => ({ symbols: [fixtureSymbol] }),
    logger: null,
    eventBus: { safeEmit: (name, payload) => { emitted = { name, payload }; } },
  });
  await registry.refresh();
  assert.equal(emitted.name, 'registry:refreshed');
  assert.equal(emitted.payload.count, 1);
});

test('SymbolRegistry.start performs an immediate refresh and schedules recurring ones', async () => {
  let fetchCount = 0;
  const registry = new SymbolRegistry(
    { fetchExchangeInfo: async () => { fetchCount++; return { symbols: [fixtureSymbol] }; }, logger: null, eventBus: null },
    { refreshIntervalMs: 1_000_000 } // long interval; we only assert the immediate call here
  );
  await registry.start();
  assert.equal(fetchCount, 1);
  registry.stop();
});

test('SymbolRegistry throws a clear error when constructed without fetchExchangeInfo', () => {
  assert.throws(() => new SymbolRegistry({ logger: null, eventBus: null }));
});
