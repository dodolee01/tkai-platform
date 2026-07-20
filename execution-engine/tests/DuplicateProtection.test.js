import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DuplicateProtection, computeIdempotencyKey } from '../src/DuplicateProtection.js';

test('computeIdempotencyKey is deterministic for identical economic terms', () => {
  const plan = { symbol: 'BTCUSDT', side: 'LONG', positionSize: 200, leverage: 5, stopLoss: 64000, takeProfit: 67000 };
  assert.equal(computeIdempotencyKey(plan), computeIdempotencyKey({ ...plan }));
});

test('computeIdempotencyKey differs when economic terms differ', () => {
  const plan = { symbol: 'BTCUSDT', side: 'LONG', positionSize: 200, leverage: 5, stopLoss: 64000, takeProfit: 67000 };
  assert.notEqual(computeIdempotencyKey(plan), computeIdempotencyKey({ ...plan, positionSize: 201 }));
});

test('claim() succeeds once, then blocks the duplicate', () => {
  const dp = new DuplicateProtection({ idempotencyTtlMs: 10000 });
  assert.equal(dp.claim('key1'), true);
  assert.equal(dp.claim('key1'), false);
});

test('claimed keys expire after the TTL', () => {
  let now = 0;
  const dp = new DuplicateProtection({ idempotencyTtlMs: 1000 }, () => now);
  dp.claim('key1');
  now = 1001;
  assert.equal(dp.claim('key1'), true);
});

test('per-symbol locks prevent overlapping acquisition', () => {
  const dp = new DuplicateProtection({ idempotencyTtlMs: 1000 });
  assert.equal(dp.acquireLock('BTCUSDT'), true);
  assert.equal(dp.acquireLock('BTCUSDT'), false);
  assert.equal(dp.acquireLock('ETHUSDT'), true);
  dp.releaseLock('BTCUSDT');
  assert.equal(dp.acquireLock('BTCUSDT'), true);
});

test('reset clears both keys and locks', () => {
  const dp = new DuplicateProtection({ idempotencyTtlMs: 1000 });
  dp.claim('key1');
  dp.acquireLock('BTCUSDT');
  dp.reset();
  assert.equal(dp.isDuplicate('key1'), false);
  assert.equal(dp.isLocked('BTCUSDT'), false);
});
