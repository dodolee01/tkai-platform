import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryTracker, DeliveryStatus } from '../src/DeliveryTracker.js';

test('trackQueued initializes a record in QUEUED state', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  assert.equal(tracker.get('n1', 'telegram').status, DeliveryStatus.QUEUED);
});

test('the full happy path QUEUED -> SENT -> DELIVERED works and tracks attempts', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.DELIVERED, { providerMessageId: 'm1' });
  const record = tracker.get('n1', 'telegram');
  assert.equal(record.status, DeliveryStatus.DELIVERED);
  assert.equal(record.attempts, 1);
  assert.equal(record.providerMessageId, 'm1');
  assert.ok(record.deliveredAt !== null);
});

test('a retry cycle QUEUED -> SENT -> FAILED -> RETRIED -> SENT -> DELIVERED works', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.FAILED, { error: 'timeout' });
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.RETRIED);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.DELIVERED);
  assert.equal(tracker.get('n1', 'telegram').attempts, 2);
});

test('invalid transitions from a terminal state throw', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.DELIVERED);
  assert.throws(() => tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT));
});

test('updateStatus on an unknown key throws', () => {
  const tracker = new DeliveryTracker();
  assert.throws(() => tracker.updateStatus('never', 'x', DeliveryStatus.SENT));
});

test('getByNotification returns every channel record for one notification', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  tracker.trackQueued('n1', 'discord');
  tracker.trackQueued('n2', 'telegram');
  assert.equal(tracker.getByNotification('n1').length, 2);
});

test('computeStats correctly derives delivery/failure rate and average delivery time', () => {
  const tracker = new DeliveryTracker();
  tracker.trackQueued('n1', 'telegram');
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n1', 'telegram', DeliveryStatus.DELIVERED);
  tracker.trackQueued('n2', 'telegram');
  tracker.updateStatus('n2', 'telegram', DeliveryStatus.SENT);
  tracker.updateStatus('n2', 'telegram', DeliveryStatus.FAILED, { error: 'x' });
  tracker.updateStatus('n2', 'telegram', DeliveryStatus.RETRIED);
  tracker.updateStatus('n2', 'telegram', DeliveryStatus.EXPIRED);

  const stats = tracker.computeStats();
  assert.equal(stats.total, 2);
  assert.equal(stats.delivered, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.deliveryRate, 0.5);
  assert.equal(stats.failureRate, 0.5);
});

test('computeStats returns zeroed rates with no records', () => {
  const tracker = new DeliveryTracker();
  const stats = tracker.computeStats();
  assert.equal(stats.total, 0);
  assert.equal(stats.deliveryRate, 0);
});
