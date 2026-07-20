import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/RateLimiter.js';

test('acquire is immediate while under capacity', async () => {
  const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
  const start = Date.now();
  await limiter.acquire();
  assert.ok(Date.now() - start < 50);
});

test('hasCapacity reflects the current load against the window', () => {
  let now = 0;
  const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 }, () => now);
  limiter.acquire();
  limiter.acquire();
  assert.equal(limiter.hasCapacity(), false);
  now = 1001;
  assert.equal(limiter.hasCapacity(), true);
});

test('currentLoad prunes expired timestamps', () => {
  let now = 0;
  const limiter = new RateLimiter({ maxRequests: 10, windowMs: 500 }, () => now);
  limiter.acquire();
  now = 600;
  assert.equal(limiter.currentLoad(), 0);
});

test('reset clears all tracked requests', async () => {
  const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
  await limiter.acquire();
  limiter.reset();
  assert.equal(limiter.currentLoad(), 0);
  assert.equal(limiter.hasCapacity(), true);
});
