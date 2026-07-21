import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/RateLimiter.js';
import { createConfig } from '../src/Config.js';

test('checkAndRecord allows requests under both user and provider limits', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 3, perUserPerHour: 100, perProviderPerMinute: 100, perProviderPerHour: 1000 } }).rateLimiter);
  for (let i = 0; i < 3; i++) assert.equal(rl.checkAndRecord('u1', 'claude').allowed, true);
});

test('checkAndRecord blocks once the per-user-per-minute limit is reached', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 2, perUserPerHour: 100, perProviderPerMinute: 100, perProviderPerHour: 1000 } }).rateLimiter);
  rl.checkAndRecord('u1', 'claude');
  rl.checkAndRecord('u1', 'claude');
  assert.equal(rl.checkAndRecord('u1', 'claude').allowed, false);
});

test('different users are independently rate-limited', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 1, perUserPerHour: 100, perProviderPerMinute: 100, perProviderPerHour: 1000 } }).rateLimiter);
  rl.checkAndRecord('u1', 'claude');
  assert.equal(rl.checkAndRecord('u2', 'claude').allowed, true);
});

test('the per-hour limit blocks even when each per-minute window is individually fresh (the critical multi-window check)', () => {
  let now = 0;
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 100, perUserPerHour: 3, perProviderPerMinute: 100, perProviderPerHour: 1000 } }).rateLimiter, () => now);
  rl.checkAndRecord('u1', 'claude');
  now += 61000;
  rl.checkAndRecord('u1', 'claude');
  now += 61000;
  rl.checkAndRecord('u1', 'claude');
  now += 61000;
  const fourth = rl.checkAndRecord('u1', 'claude');
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.exceeded.some((e) => e.includes('perHour')));
});

test('provider dimension is tracked independently of the user dimension', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 100, perUserPerHour: 100, perProviderPerMinute: 1, perProviderPerHour: 100 } }).rateLimiter);
  rl.checkAndRecord('u1', 'claude');
  const blocked = rl.checkAndRecord('u2', 'claude'); // different user, same provider -> provider limit hit
  assert.equal(blocked.allowed, false);
  assert.equal(rl.checkAndRecord('u2', 'openai').allowed, true); // different provider is unaffected
});

test('reset clears all tracked rate limit state', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 1 } }).rateLimiter);
  rl.checkAndRecord('u1', 'claude');
  rl.reset();
  assert.equal(rl.checkAndRecord('u1', 'claude').allowed, true);
});

test('check() alone does not record — repeated checks never exhaust the limit', () => {
  const rl = new RateLimiter(createConfig({ rateLimiter: { perUserPerMinute: 1, perUserPerHour: 10 } }).rateLimiter);
  rl.check('user', 'u1', { perMinute: 1, perHour: 10 });
  rl.check('user', 'u1', { perMinute: 1, perHour: 10 });
  assert.equal(rl.check('user', 'u1', { perMinute: 1, perHour: 10 }).allowed, true);
});
