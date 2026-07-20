import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Metrics } from '../src/Metrics.js';
import { HealthMonitor } from '../src/HealthMonitor.js';
import { NotificationQueue } from '../src/NotificationQueue.js';
import { DeliveryTracker } from '../src/DeliveryTracker.js';
import { createConfig } from '../src/Config.js';
import { Priority } from '../src/NotificationPriority.js';

test('Metrics computes success/failure rate correctly from mixed deliveries', () => {
  const metrics = new Metrics(createConfig().metrics);
  metrics.recordDelivery('telegram', true, 100);
  metrics.recordDelivery('telegram', true, 200);
  metrics.recordDelivery('discord', false, 0);
  assert.ok(Math.abs(metrics.getSuccessRate() - 2 / 3) < 1e-9);
  assert.equal(metrics.getAverageDeliveryTimeMs(), 150);
});

test('Metrics.getNotificationsPerMinute only counts recent sends', () => {
  let now = 0;
  const metrics = new Metrics(createConfig().metrics);
  const originalDateNow = Date.now;
  Date.now = () => now;
  metrics.recordSent();
  now = 30000;
  metrics.recordSent();
  now = 70000; // first send now outside the 60s window
  const count = metrics.getNotificationsPerMinute();
  Date.now = originalDateNow;
  assert.equal(count, 1);
});

test('Metrics.getProviderPerformance tracks per-channel success rate and avg latency', () => {
  const metrics = new Metrics(createConfig().metrics);
  metrics.recordDelivery('telegram', true, 100);
  metrics.recordDelivery('telegram', true, 300);
  metrics.recordDelivery('telegram', false, 0);
  const perf = metrics.getProviderPerformance().telegram;
  assert.equal(perf.sent, 3);
  assert.ok(Math.abs(perf.successRate - 2 / 3) < 1e-9);
  assert.equal(perf.avgLatencyMs, 200);
});

test('HealthMonitor flags critical status when the queue size critical threshold is breached', () => {
  const queue = new NotificationQueue();
  for (let i = 0; i < 5; i++) queue.enqueue({ id: `n${i}`, priority: Priority.LOW });
  const monitor = new HealthMonitor(
    { metrics: new Metrics(createConfig().metrics), queue, deliveryTracker: new DeliveryTracker() },
    createConfig({ health: { queueSizeCriticalThreshold: 4, queueSizeWarnThreshold: 2 } }).health
  );
  assert.equal(monitor.check().status, 'critical');
});

test('HealthMonitor flags warning (not critical) when failure rate crosses the warn threshold only', () => {
  const metrics = new Metrics(createConfig().metrics);
  for (let i = 0; i < 4; i++) metrics.recordDelivery('telegram', true, 10);
  metrics.recordDelivery('telegram', false, 0);
  const monitor = new HealthMonitor(
    { metrics, queue: new NotificationQueue(), deliveryTracker: new DeliveryTracker() },
    createConfig({ health: { failureRateWarnThreshold: 0.1, failureRateCriticalThreshold: 0.5 } }).health
  );
  assert.equal(monitor.check().status, 'warning');
});

test('reportProviderStatus makes an unavailable provider surface in health issues', () => {
  const monitor = new HealthMonitor(
    { metrics: new Metrics(createConfig().metrics), queue: new NotificationQueue(), deliveryTracker: new DeliveryTracker() },
    createConfig().health
  );
  monitor.reportProviderStatus('telegram', false, 'connection refused');
  const result = monitor.check();
  assert.ok(result.issues.some((i) => i.includes('telegram')));
});

test('getReport bundles every documented health field', () => {
  const monitor = new HealthMonitor(
    { metrics: new Metrics(createConfig().metrics), queue: new NotificationQueue(), deliveryTracker: new DeliveryTracker() },
    createConfig().health
  );
  const report = monitor.getReport();
  for (const key of ['status', 'issues', 'queueSize', 'deliveryStats', 'providerAvailability', 'retryCount', 'averageDeliveryTimeMs']) {
    assert.ok(key in report);
  }
});
