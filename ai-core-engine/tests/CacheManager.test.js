import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager, computeCacheKey } from '../src/CacheManager.js';
import { createConfig } from '../src/Config.js';

test('computeCacheKey ignores userId so identical prompts share a cache entry across users', () => {
  const req1 = { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o', userId: 'u1' };
  const req2 = { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o', userId: 'u2' };
  assert.equal(computeCacheKey(req1), computeCacheKey(req2));
});

test('computeCacheKey differs when message content differs', () => {
  const req1 = { messages: [{ role: 'user', content: 'hi' }] };
  const req2 = { messages: [{ role: 'user', content: 'bye' }] };
  assert.notEqual(computeCacheKey(req1), computeCacheKey(req2));
});

test('get returns the cached value before TTL expiry, undefined after', () => {
  let now = 0;
  const cache = new CacheManager(createConfig({ cache: { ttlMs: 1000 } }).cache, () => now);
  cache.set('a', 'valueA');
  assert.equal(cache.get('a'), 'valueA');
  now = 1500;
  assert.equal(cache.get('a'), undefined);
});

test('LRU eviction removes the least-recently-used entry, not the oldest-inserted', () => {
  const cache = new CacheManager(createConfig({ cache: { maxEntries: 3 } }).cache);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  cache.get('a'); // touch 'a'
  cache.set('d', 4); // evicts 'b', the true LRU
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('d'), true);
});

test('getStats tracks hits, misses, and hit rate correctly', () => {
  const cache = new CacheManager(createConfig().cache);
  cache.set('x', 100);
  cache.get('x');
  cache.get('y');
  const stats = cache.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.hitRate, 0.5);
});

test('delete removes an entry and reports success/failure correctly', () => {
  const cache = new CacheManager(createConfig().cache);
  cache.set('x', 1);
  assert.equal(cache.delete('x'), true);
  assert.equal(cache.delete('x'), false);
});

test('a per-entry TTL override is respected independently of the default', () => {
  let now = 0;
  const cache = new CacheManager(createConfig({ cache: { ttlMs: 10000 } }).cache, () => now);
  cache.set('short', 1, 100);
  now = 50;
  assert.equal(cache.get('short'), 1);
  now = 200;
  assert.equal(cache.get('short'), undefined);
});

test('clear empties the cache and resets stats', () => {
  const cache = new CacheManager(createConfig().cache);
  cache.set('x', 1);
  cache.get('x');
  cache.clear();
  assert.equal(cache.has('x'), false);
  assert.deepEqual(cache.getStats(), { size: 0, hits: 0, misses: 0, hitRate: 0 });
});
