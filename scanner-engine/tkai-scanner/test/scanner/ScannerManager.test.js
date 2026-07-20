import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScannerManager } from '../../src/scanner/ScannerManager.js';

const fixtureExchangeInfo = {
  symbols: [
    {
      symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING',
      contractType: 'PERPETUAL', pricePrecision: 2, quantityPrecision: 3,
      filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.10' }],
    },
    {
      symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING',
      contractType: 'PERPETUAL', pricePrecision: 2, quantityPrecision: 3,
      filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.01' }],
    },
  ],
};

function fixtureFetchJson() {
  let oiCalls = 0;
  const fn = async (restBaseUrl, path) => {
    if (path.includes('exchangeInfo')) return fixtureExchangeInfo;
    if (path.includes('openInterest')) {
      oiCalls++;
      const symbol = new URLSearchParams(path.split('?')[1]).get('symbol');
      return { symbol, openInterest: '999.5', time: Date.now() };
    }
    throw new Error('unexpected path: ' + path);
  };
  fn.getOiCalls = () => oiCalls;
  return fn;
}

test('ScannerManager wires all subsystems from config on construction', () => {
  const scanner = new ScannerManager({ env: 'development', fetchJson: fixtureFetchJson() });
  assert.equal(scanner.config.environment, 'development');
  assert.ok(scanner.logger);
  assert.ok(scanner.eventBus);
  assert.ok(scanner.metrics);
  assert.ok(scanner.healthMonitor);
  assert.ok(scanner.symbolRegistry);
  assert.ok(scanner.openInterestPoller);
  assert.ok(scanner.workerPool);
  assert.equal(scanner.isRunning, false);
});

test('symbol registry populates from the injected fetchJson (no network)', async () => {
  const fetchJson = fixtureFetchJson();
  const scanner = new ScannerManager({ env: 'development', fetchJson });
  await scanner.symbolRegistry.start();
  assert.equal(scanner.symbolRegistry.size, 2);
  scanner.symbolRegistry.stop();
  await scanner.logger.close();
});

test('open interest poller populates the master cache via injected fetchJson', async () => {
  const fetchJson = fixtureFetchJson();
  const scanner = new ScannerManager({ env: 'development', fetchJson });
  scanner.openInterestPoller.setSymbols(['BTCUSDT', 'ETHUSDT']);
  await scanner.openInterestPoller.pollNextBatch();
  assert.equal(fetchJson.getOiCalls(), 2);
  assert.equal(scanner.masterCache.get('BTCUSDT').openInterest, 999.5);
  await scanner.logger.close();
});

test('getMarketSnapshot merges master-side open interest into worker snapshot data', async () => {
  const scanner = new ScannerManager({ env: 'development', fetchJson: fixtureFetchJson() });
  scanner.masterCache.update('BTCUSDT', { openInterest: 777 });
  scanner.workerPool.getAggregatedCacheSnapshot = async () => [{ symbol: 'BTCUSDT', price: 1, openInterest: null }];
  const snapshot = await scanner.getMarketSnapshot();
  assert.equal(snapshot[0].openInterest, 777);
  await scanner.logger.close();
});

test('start() throws a clear error if the registry resolves zero symbols', async () => {
  const scanner = new ScannerManager({
    env: 'development',
    fetchJson: async (base, path) => (path.includes('exchangeInfo') ? { symbols: [] } : { symbol: 'X', openInterest: '0', time: 1 }),
  });
  await assert.rejects(() => scanner.start(), /zero tradable symbols/);
  await scanner.logger.close();
});

test('loadConfig rejects an unknown environment name', () => {
  assert.throws(() => new ScannerManager({ env: 'not-a-real-env', fetchJson: fixtureFetchJson() }));
});
