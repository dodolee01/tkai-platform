import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/RateLimiter.js';
import { createConfig } from '../src/Config.js';

test('checkAndRecord allows attempts under the per-minute limit', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 3, perHour: 1000, perDay: 10000 } }).rateLimiter);
  for (let i = 0; i < 3; i++) {
    assert.equal(rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' }).allowed, true);
  }
});

test('checkAndRecord blocks once the per-minute limit is reached', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 2, perHour: 1000, perDay: 10000 } }).rateLimiter);
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  const third = rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  assert.equal(third.allowed, false);
});

test('different users are independently limited on the "user" dimension', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 1, perHour: 1000, perDay: 10000 } }).rateLimiter);
  assert.equal(rl.check('user', 'u1').allowed, true);
  rl.record('user', 'u1');
  assert.equal(rl.check('user', 'u1').allowed, false); // u1 exhausted
  assert.equal(rl.check('user', 'u2').allowed, true); // u2 is a separate bucket
});

test('channel and type dimensions are intentionally global (shared across users), protecting the shared resource', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 1, perHour: 1000, perDay: 10000 } }).rateLimiter);
  assert.equal(rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' }).allowed, true);
  // A different user hitting the SAME channel is blocked once that channel's global cap is hit —
  // this protects the channel's own external rate limit (e.g. Telegram's API limits), not a per-user quota.
  assert.equal(rl.checkAndRecord({ userId: 'u2', channel: 'telegram', type: 'y' }).allowed, false);
});

test('capacity frees up after the minute window elapses', () => {
  let now = 0;
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 1, perHour: 1000, perDay: 10000 } }).rateLimiter, () => now);
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  assert.equal(rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' }).allowed, false);
  now = 61000;
  assert.equal(rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' }).allowed, true);
});

test('the hourly limit blocks even when the per-minute limit is not exceeded', () => {
  let now = 0;
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 100, perHour: 2, perDay: 10000 } }).rateLimiter, () => now);
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  now += 61000;
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  now += 61000;
  const third = rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  assert.equal(third.allowed, false);
  assert.ok(third.exceeded.some((e) => e.includes('perHour')));
});

test('reset clears all tracked rate limit state', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 1 } }).rateLimiter);
  rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' });
  rl.reset();
  assert.equal(rl.checkAndRecord({ userId: 'u1', channel: 'telegram', type: 'x' }).allowed, true);
});

test('check() does not record — repeated checks alone never exhaust the limit', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perMinute: 1 } }).rateLimiter);
  rl.check('user', 'u1');
  rl.check('user', 'u1');
  assert.equal(rl.check('user', 'u1').allowed, true);
});
