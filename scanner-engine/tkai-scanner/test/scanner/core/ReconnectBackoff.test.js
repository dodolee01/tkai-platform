import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReconnectBackoff } from '../../../src/scanner/core/ReconnectBackoff.js';

test('ReconnectBackoff grows exponentially without jitter', () => {
  const backoff = new ReconnectBackoff({ initialDelayMs: 100, maxDelayMs: 10000, multiplier: 2, jitterRatio: 0 });
  assert.equal(backoff.next(), 100);
  assert.equal(backoff.next(), 200);
  assert.equal(backoff.next(), 400);
  assert.equal(backoff.next(), 800);
});

test('ReconnectBackoff respects the max delay ceiling', () => {
  const backoff = new ReconnectBackoff({ initialDelayMs: 1000, maxDelayMs: 3000, multiplier: 10, jitterRatio: 0 });
  backoff.next(); // 1000
  backoff.next(); // would be 10000, capped to 3000
  const third = backoff.next();
  assert.equal(third, 3000);
});

test('ReconnectBackoff.reset returns to the initial delay', () => {
  const backoff = new ReconnectBackoff({ initialDelayMs: 50, maxDelayMs: 1000, multiplier: 2, jitterRatio: 0 });
  backoff.next();
  backoff.next();
  backoff.reset();
  assert.equal(backoff.attempt, 0);
  assert.equal(backoff.next(), 50);
});

test('ReconnectBackoff jitter stays within the configured ratio', () => {
  const backoff = new ReconnectBackoff({ initialDelayMs: 1000, maxDelayMs: 100000, multiplier: 1, jitterRatio: 0.5 });
  for (let i = 0; i < 20; i++) {
    const delay = backoff.next();
    assert.ok(delay >= 500 && delay <= 1500, `delay ${delay} out of expected jitter range`);
  }
});
