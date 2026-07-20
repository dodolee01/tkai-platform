import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenInterestPoller } from '../../../src/scanner/registry/OpenInterestPoller.js';
import { CoinCache } from '../../../src/scanner/cache/CoinCache.js';

test('OpenInterestPoller polls only symbolsPerTick symbols per batch', async () => {
  let calls = [];
  const poller = new OpenInterestPoller(
    { fetchOpenInterest: async (s) => { calls.push(s); return { symbol: s, openInterest: '100', time: 1 }; }, cache: new CoinCache(), eventBus: null, logger: null },
    { symbolsPerTick: 2 }
  );
  poller.setSymbols(['A', 'B', 'C', 'D']);
  await poller.pollNextBatch();
  assert.deepEqual(calls, ['A', 'B']);
});

test('OpenInterestPoller wraps the cursor around the symbol list', async () => {
  let calls = [];
  const poller = new OpenInterestPoller(
    { fetchOpenInterest: async (s) => { calls.push(s); return { symbol: s, openInterest: '1', time: 1 }; }, cache: new CoinCache(), eventBus: null, logger: null },
    { symbolsPerTick: 3 }
  );
  poller.setSymbols(['A', 'B', 'C', 'D']);
  await poller.pollNextBatch(); // A, B, C
  await poller.pollNextBatch(); // D, A, B
  assert.deepEqual(calls, ['A', 'B', 'C', 'D', 'A', 'B']);
});

test('OpenInterestPoller updates the cache with numeric open interest', async () => {
  const cache = new CoinCache();
  const poller = new OpenInterestPoller(
    { fetchOpenInterest: async (s) => ({ symbol: s, openInterest: '4242.5', time: 1 }), cache, eventBus: null, logger: null },
    { symbolsPerTick: 1 }
  );
  poller.setSymbols(['BTCUSDT']);
  await poller.pollNextBatch();
  assert.equal(cache.get('BTCUSDT').openInterest, 4242.5);
});

test('OpenInterestPoller tolerates individual symbol fetch failures', async () => {
  const cache = new CoinCache();
  let errorLogged = false;
  const poller = new OpenInterestPoller(
    {
      fetchOpenInterest: async (s) => { if (s === 'BAD') throw new Error('network fail'); return { symbol: s, openInterest: '1', time: 1 }; },
      cache,
      eventBus: null,
      logger: { warn: () => { errorLogged = true; } },
    },
    { symbolsPerTick: 2 }
  );
  poller.setSymbols(['BAD', 'GOOD']);
  await poller.pollNextBatch();
  assert.equal(errorLogged, true);
  assert.equal(cache.get('GOOD').openInterest, 1);
  assert.equal(cache.get('BAD'), undefined);
});
