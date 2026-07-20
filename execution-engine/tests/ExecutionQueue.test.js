import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionQueue } from '../src/ExecutionQueue.js';

test('same-symbol tasks never overlap in execution', async () => {
  const queue = new ExecutionQueue({ maxConcurrentGlobal: 2 });
  const order = [];
  const p1 = queue.enqueue('BTCUSDT', async () => { order.push('1-start'); await new Promise(r => setTimeout(r, 20)); order.push('1-end'); });
  const p2 = queue.enqueue('BTCUSDT', async () => { order.push('2-start'); await new Promise(r => setTimeout(r, 5)); order.push('2-end'); });
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ['1-start', '1-end', '2-start', '2-end']);
});

test('different-symbol tasks can run concurrently', async () => {
  const queue = new ExecutionQueue({ maxConcurrentGlobal: 2 });
  const order = [];
  const p1 = queue.enqueue('BTCUSDT', async () => { order.push('btc-start'); await new Promise(r => setTimeout(r, 20)); order.push('btc-end'); });
  const p2 = queue.enqueue('ETHUSDT', async () => { order.push('eth-start'); await new Promise(r => setTimeout(r, 5)); order.push('eth-end'); });
  await Promise.all([p1, p2]);
  const ethEndIdx = order.indexOf('eth-end');
  const btcEndIdx = order.indexOf('btc-end');
  assert.ok(ethEndIdx < btcEndIdx); // the shorter ETH task finished first, proving concurrency
});

test('maxConcurrentGlobal=1 forces full serialization across all symbols', async () => {
  const queue = new ExecutionQueue({ maxConcurrentGlobal: 1 });
  const order = [];
  const p1 = queue.enqueue('A', async () => { order.push('A-start'); await new Promise(r => setTimeout(r, 10)); order.push('A-end'); });
  const p2 = queue.enqueue('B', async () => { order.push('B-start'); await new Promise(r => setTimeout(r, 5)); order.push('B-end'); });
  await Promise.all([p1, p2]);
  assert.deepEqual(order, ['A-start', 'A-end', 'B-start', 'B-end']);
});

test('resolves with the task result and rejects with the task error', async () => {
  const queue = new ExecutionQueue({ maxConcurrentGlobal: 2 });
  const result = await queue.enqueue('X', async () => 42);
  assert.equal(result, 42);
  await assert.rejects(() => queue.enqueue('Y', async () => { throw new Error('boom'); }), /boom/);
});

test('pendingCount and activeCount report accurate live state', async () => {
  const queue = new ExecutionQueue({ maxConcurrentGlobal: 1 });
  let resolveTask;
  const blocked = new Promise((r) => { resolveTask = r; });
  const p1 = queue.enqueue('A', async () => { await blocked; return 'done'; });
  const p2 = queue.enqueue('A', async () => 'second');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(queue.activeCount, 1);
  assert.equal(queue.pendingCount, 1);
  resolveTask();
  await Promise.all([p1, p2]);
  assert.equal(queue.activeCount, 0);
  assert.equal(queue.pendingCount, 0);
});
