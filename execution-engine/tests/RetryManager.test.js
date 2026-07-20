import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RetryManager } from '../src/RetryManager.js';

const instantDelay = async () => {};

test('succeeds immediately when the operation succeeds on the first try', async () => {
  const retry = new RetryManager({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10, multiplier: 2 }, instantDelay);
  const result = await retry.execute(async () => 'ok');
  assert.equal(result.success, true);
  assert.equal(result.attempts, 1);
});

test('retries a retryable error until it succeeds', async () => {
  const retry = new RetryManager({ maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 10, multiplier: 2 }, instantDelay);
  let calls = 0;
  const result = await retry.execute(async () => {
    calls += 1;
    if (calls < 3) throw new Error('timeout');
    return 'ok';
  });
  assert.equal(result.success, true);
  assert.equal(result.attempts, 3);
});

test('stops immediately on a non-retryable error, without exhausting maxAttempts', async () => {
  const retry = new RetryManager({ maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 10, multiplier: 2 }, instantDelay);
  let calls = 0;
  const result = await retry.execute(async () => {
    calls += 1;
    throw { code: -2019, msg: 'Margin is insufficient.' };
  });
  assert.equal(result.success, false);
  assert.equal(calls, 1);
});

test('gives up after maxAttempts on a persistently retryable error', async () => {
  const retry = new RetryManager({ maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 10, multiplier: 2 }, instantDelay);
  let calls = 0;
  const result = await retry.execute(async () => {
    calls += 1;
    throw new Error('connection lost');
  });
  assert.equal(result.success, false);
  assert.equal(result.attempts, 4);
  assert.equal(calls, 4);
});
