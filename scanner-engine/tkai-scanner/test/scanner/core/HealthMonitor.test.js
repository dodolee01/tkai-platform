import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HealthMonitor } from '../../../src/scanner/core/HealthMonitor.js';
import { EventBus, ScannerEvents } from '../../../src/scanner/core/EventBus.js';
import { Metrics } from '../../../src/scanner/core/Metrics.js';

test('HealthMonitor flags critical status on high memory', () => {
  const eventBus = new EventBus();
  const metrics = { lastSnapshot: { memoryRssMb: 5000, cpuPct: 10 } };
  const monitor = new HealthMonitor({ metrics, eventBus, logger: null }, { memoryCriticalMb: 2048, memoryWarnMb: 1024 });
  let criticalFired = false;
  eventBus.on(ScannerEvents.HEALTH_CRITICAL, () => { criticalFired = true; });
  const result = monitor.check();
  assert.equal(result.status, 'critical');
  assert.equal(criticalFired, true);
});

test('HealthMonitor detects a reconnect loop', () => {
  const eventBus = new EventBus();
  const monitor = new HealthMonitor(
    { metrics: { lastSnapshot: null }, eventBus, logger: null },
    { reconnectLoopThreshold: 3, reconnectLoopWindowMs: 60000 }
  );
  monitor.recordReconnect();
  monitor.recordReconnect();
  monitor.recordReconnect();
  const result = monitor.check();
  assert.equal(result.status, 'critical');
  assert.ok(result.issues.some((i) => i.includes('reconnect loop')));
});

test('HealthMonitor detects and recovers a frozen worker', () => {
  const eventBus = new EventBus();
  const monitor = new HealthMonitor(
    { metrics: { lastSnapshot: null }, eventBus, logger: null },
    { workerFrozenThresholdMs: 10 }
  );
  let recovered = false;
  monitor.registerWorker('worker-0', () => { recovered = true; });
  // No heartbeat recorded; wait past the threshold synchronously via a busy check.
  const start = Date.now();
  while (Date.now() - start < 15) { /* spin to exceed threshold deterministically */ }
  const result = monitor.check();
  assert.equal(result.status, 'critical');
  assert.equal(recovered, true);
});

test('HealthMonitor.check returns healthy with no metrics and no registrations', () => {
  const monitor = new HealthMonitor({ metrics: new Metrics(), eventBus: new EventBus(), logger: null });
  const result = monitor.check();
  assert.equal(result.status, 'healthy');
  assert.deepEqual(result.issues, []);
});

test('HealthMonitor emits HEALTH_RECOVERED after returning from a bad status', () => {
  const eventBus = new EventBus();
  const metricsRef = { lastSnapshot: { memoryRssMb: 5000, cpuPct: 10 } };
  const monitor = new HealthMonitor({ metrics: metricsRef, eventBus, logger: null }, { memoryCriticalMb: 2048 });
  monitor.check(); // goes critical
  let recoveredFired = false;
  eventBus.on(ScannerEvents.HEALTH_RECOVERED, () => { recoveredFired = true; });
  metricsRef.lastSnapshot = { memoryRssMb: 10, cpuPct: 5 };
  const result = monitor.check();
  assert.equal(result.status, 'healthy');
  assert.equal(recoveredFired, true);
});
