import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoinCache } from '../../../src/scanner/cache/CoinCache.js';

test('CoinCache.update merges partial patches without clobbering other fields', () => {
  const cache = new CoinCache();
  cache.update('BTCUSDT', { price: 100 });
  cache.update('BTCUSDT', { volume: 5000 });
  const entry = cache.get('BTCUSDT');
  assert.equal(entry.price, 100);
  assert.equal(entry.volume, 5000);
});

test('CoinCache.updateBookTicker computes spread', () => {
  const cache = new CoinCache();
  cache.updateBookTicker('ETHUSDT', 3000, 3001.5);
  assert.equal(cache.get('ETHUSDT').spread, 1.5);
});

test('CoinCache.recordLiquidation accumulates by side', () => {
  const cache = new CoinCache();
  cache.recordLiquidation('BTCUSDT', 'SELL', 1000);
  cache.recordLiquidation('BTCUSDT', 'SELL', 500);
  cache.recordLiquidation('BTCUSDT', 'BUY', 200);
  const stats = cache.get('BTCUSDT').liquidationStats;
  assert.equal(stats.longNotional, 1500);
  assert.equal(stats.shortNotional, 200);
  assert.equal(stats.eventCount, 3);
});

test('CoinCache.evictStale removes only entries older than maxAgeMs', async () => {
  const cache = new CoinCache();
  cache.update('OLD', { price: 1 });
  await new Promise((r) => setTimeout(r, 30));
  cache.update('NEW', { price: 2 });
  const evicted = cache.evictStale(15);
  assert.equal(evicted, 1);
  assert.equal(cache.get('OLD'), undefined);
  assert.ok(cache.get('NEW'));
});

test('CoinCache.getAll and size reflect current entries', () => {
  const cache = new CoinCache();
  cache.update('A', { price: 1 });
  cache.update('B', { price: 2 });
  assert.equal(cache.size, 2);
  assert.equal(cache.getAll().length, 2);
});
