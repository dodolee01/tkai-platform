import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationQueue } from '../src/NotificationQueue.js';
import { Priority } from '../src/NotificationPriority.js';

test('dequeue respects priority order across the standard five levels', () => {
  const q = new NotificationQueue();
  q.enqueue({ id: 'info', priority: Priority.INFO });
  q.enqueue({ id: 'low', priority: Priority.LOW });
  q.enqueue({ id: 'critical', priority: Priority.CRITICAL });
  q.enqueue({ id: 'medium', priority: Priority.MEDIUM });
  q.enqueue({ id: 'high', priority: Priority.HIGH });

  const order = [q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue(), q.dequeue()].map((n) => n.id);
  assert.deepEqual(order, ['critical', 'high', 'medium', 'low', 'info']);
});

test('FIFO order is preserved within the same priority level', () => {
  const q = new NotificationQueue();
  q.enqueue({ id: 'first', priority: Priority.HIGH });
  q.enqueue({ id: 'second', priority: Priority.HIGH });
  assert.equal(q.dequeue().id, 'first');
  assert.equal(q.dequeue().id, 'second');
});

test('dequeue returns null when the queue is empty', () => {
  const q = new NotificationQueue();
  assert.equal(q.dequeue(), null);
});

test('enqueue rejects an unknown priority', () => {
  const q = new NotificationQueue();
  assert.throws(() => q.enqueue({ id: 'x', priority: 'NOT_REAL' }));
});

test('delayed items are released into the main queue only once due', () => {
  const q = new NotificationQueue();
  q.enqueueDelayed({ id: 'd1', priority: Priority.LOW }, 1000, 0);
  assert.equal(q.processDelayed(500), 0);
  assert.equal(q.mainQueueSize, 0);
  assert.equal(q.processDelayed(1500), 1);
  assert.equal(q.mainQueueSize, 1);
});

test('retry items are released into the main queue only once due', () => {
  const q = new NotificationQueue();
  q.enqueueRetry({ id: 'r1', priority: Priority.HIGH }, 500, 1, 0);
  assert.equal(q.processRetries(100), 0);
  assert.equal(q.processRetries(600), 1);
  assert.equal(q.mainQueueSize, 1);
});

test('dead letter queue accumulates items with their failure reason', () => {
  const q = new NotificationQueue();
  q.enqueueDeadLetter({ id: 'x', priority: Priority.HIGH }, 'exhausted retries');
  const dlq = q.getDeadLetterQueue();
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].reason, 'exhausted retries');
});

test('getSizes accurately reports every queue at once', () => {
  const q = new NotificationQueue();
  q.enqueue({ id: 'a', priority: Priority.LOW });
  q.enqueueDelayed({ id: 'b', priority: Priority.LOW }, 1000, 0);
  q.enqueueRetry({ id: 'c', priority: Priority.LOW }, 1000, 1, 0);
  q.enqueueDeadLetter({ id: 'd', priority: Priority.LOW }, 'x');
  assert.deepEqual(q.getSizes(), { main: 1, delayed: 1, retry: 1, deadLetter: 1 });
});
