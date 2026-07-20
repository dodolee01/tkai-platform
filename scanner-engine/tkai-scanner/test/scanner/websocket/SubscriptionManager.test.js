import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubscriptionManager } from '../../../src/scanner/websocket/SubscriptionManager.js';

function fakeConnection() {
  const sent = [];
  return { sent, send: (data) => sent.push(JSON.parse(data)) };
}

test('subscribe batches and sends SUBSCRIBE messages, tracking active streams', async () => {
  const connection = fakeConnection();
  const manager = new SubscriptionManager({ connection, logger: null }, { batchSize: 2, intervalMs: 1 });
  await manager.subscribe(['a', 'b', 'c']);
  assert.equal(connection.sent.length, 2);
  assert.equal(connection.sent[0].method, 'SUBSCRIBE');
  assert.equal(manager.size, 3);
});

test('subscribe does not re-send already-active streams', async () => {
  const connection = fakeConnection();
  const manager = new SubscriptionManager({ connection, logger: null }, { batchSize: 10 });
  await manager.subscribe(['a', 'b']);
  await manager.subscribe(['b', 'c']); // 'b' already active
  const allSentStreams = connection.sent.flatMap((m) => m.params);
  assert.deepEqual(allSentStreams.sort(), ['a', 'b', 'c'].sort());
});

test('unsubscribe removes streams and sends UNSUBSCRIBE', async () => {
  const connection = fakeConnection();
  const manager = new SubscriptionManager({ connection, logger: null }, { batchSize: 10 });
  await manager.subscribe(['a', 'b']);
  await manager.unsubscribe(['a']);
  assert.equal(manager.size, 1);
  assert.equal(connection.sent[1].method, 'UNSUBSCRIBE');
});

test('resubscribeAll re-issues SUBSCRIBE for every currently tracked stream', async () => {
  const connection = fakeConnection();
  const manager = new SubscriptionManager({ connection, logger: null }, { batchSize: 10 });
  await manager.subscribe(['a', 'b']);
  connection.sent.length = 0; // clear history
  await manager.resubscribeAll();
  assert.equal(connection.sent.length, 1);
  assert.deepEqual(connection.sent[0].params.sort(), ['a', 'b']);
  assert.equal(manager.size, 2);
});
