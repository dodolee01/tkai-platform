import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RetryManager } from '../src/RetryManager.js';
import { createConfig } from '../src/Config.js';

const instantDelay = async () => {};

test('exponential backoff delay grows by the configured multiplier', () => {
  const rm = new RetryManager(createConfig({ retry: { strategy: 'exponential', baseDelayMs: 100, multiplier: 3, maxDelayMs: 100000 } }).retry);
  assert.equal(rm.computeDelay(0), 100);
  assert.equal(rm.computeDelay(1), 300);
  assert.equal(rm.computeDelay(2), 900);
});

test('linear backoff delay grows by a fixed increment', () => {
  const rm = new RetryManager(createConfig({ retry: { strategy: 'linear', baseDelayMs: 100, incrementMs: 50, maxDelayMs: 100000 } }).retry);
  assert.equal(rm.computeDelay(0), 100);
  assert.equal(rm.computeDelay(1), 150);
  assert.equal(rm.computeDelay(2), 200);
});

test('delay is capped at maxDelayMs', () => {
  const rm = new RetryManager(createConfig({ retry: { strategy: 'exponential', baseDelayMs: 1000, multiplier: 10, maxDelayMs: 5000 } }).retry);
  assert.equal(rm.computeDelay(5), 5000);
});

test('execute succeeds immediately on the first try', async () => {
  const rm = new RetryManager(createConfig({ retry: { maxAttempts: 3 } }).retry, instantDelay);
  const result = await rm.execute(async () => 'ok');
  assert.equal(result.success, true);
  assert.equal(result.attempts, 1);
});

test('execute retries and eventually succeeds', async () => {
  const rm = new RetryManager(createConfig({ retry: { maxAttempts: 5 } }).retry, instantDelay);
  let calls = 0;
  const result = await rm.execute(async () => { calls++; if (calls < 3) throw new Error('x'); return 'ok'; });
  assert.equal(result.success, true);
  assert.equal(result.attempts, 3);
});

test('execute exhausts attempts and reports deadLettered', async () => {
  const rm = new RetryManager(createConfig({ retry: { maxAttempts: 3 } }).retry, instantDelay);
  const result = await rm.execute(async () => { throw new Error('always fails'); });
  assert.equal(result.success, false);
  assert.equal(result.deadLettered, true);
  assert.equal(result.attempts, 3);
});

test('onFailure callback fires for every failed attempt with the correct attempt index', async () => {
  const rm = new RetryManager(createConfig({ retry: { maxAttempts: 3 } }).retry, instantDelay);
  const attempts = [];
  await rm.execute(async () => { throw new Error('x'); }, (err, attempt) => attempts.push(attempt));
  assert.deepEqual(attempts, [0, 1, 2]);
});

test('hasAttemptsRemaining reflects maxAttempts correctly', () => {
  const rm = new RetryManager(createConfig({ retry: { maxAttempts: 3 } }).retry);
  assert.equal(rm.hasAttemptsRemaining(2), true);
  assert.equal(rm.hasAttemptsRemaining(3), false);
});
