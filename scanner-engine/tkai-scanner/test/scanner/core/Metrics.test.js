import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Metrics } from '../../../src/scanner/core/Metrics.js';

test('Metrics.sample computes message/event rates and resets counters', async () => {
  const metrics = new Metrics();
  metrics.recordMessage();
  metrics.recordMessage();
  metrics.recordEvent();
  await new Promise((r) => setTimeout(r, 50));
  const snap1 = metrics.sample();
  assert.ok(snap1.messagesPerSec > 0);
  assert.ok(snap1.eventsPerSec > 0);

  // Counters should have been reset — a sample with no new activity yields ~0.
  await new Promise((r) => setTimeout(r, 20));
  const snap2 = metrics.sample();
  assert.equal(snap2.messagesPerSec, 0);
});

test('Metrics cumulative counters (reconnects, dropped packets) are not reset', () => {
  const metrics = new Metrics();
  metrics.recordReconnect();
  metrics.recordReconnect();
  metrics.recordDroppedPacket();
  const snap1 = metrics.sample();
  const snap2 = metrics.sample();
  assert.equal(snap1.reconnectCount, 2);
  assert.equal(snap2.reconnectCount, 2); // still 2, cumulative
  assert.equal(snap2.droppedPackets, 1);
});

test('Metrics.recordLatency computes a correct rolling average', () => {
  const metrics = new Metrics();
  metrics.recordLatency(10);
  metrics.recordLatency(20);
  metrics.recordLatency(30);
  const snap = metrics.sample();
  assert.equal(snap.avgWsLatencyMs, 20);
});

test('Metrics.recordWorkerMessage tracks per-worker utilization', () => {
  const metrics = new Metrics();
  metrics.recordWorkerMessage('worker-0');
  metrics.recordWorkerMessage('worker-0');
  metrics.recordWorkerMessage('worker-1');
  const snap = metrics.sample();
  assert.equal(snap.workerUtilization['worker-0'], 2);
  assert.equal(snap.workerUtilization['worker-1'], 1);
});
