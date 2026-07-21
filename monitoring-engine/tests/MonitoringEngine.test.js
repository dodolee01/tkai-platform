import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringEngine } from '../src/MonitoringEngine.js';
import { HealthStatus } from '../src/HealthChecker.js';
import { MonitoringEventNames } from '../src/MonitoringEvents.js';

const silentLogger = { debug(){}, info(){}, warn(){}, error(){}, critical(){} };

test('registerService populates both ServiceRegistry and DependencyGraph', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  engine.registerService({ name: 'execution', category: 'module', dependencies: ['binance'] });
  assert.equal(engine.serviceRegistry.has('execution'), true);
  assert.ok(engine.dependencyGraph.getDependencies('execution').includes('binance'));
  await engine.shutdown();
});

test('heartbeat() records through the engine', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  engine.registerService({ name: 'execution', category: 'module' });
  const result = engine.heartbeat('execution');
  assert.equal(result.accepted, true);
  await engine.shutdown();
});

test('runMonitoringCycle returns a complete result bundle with real system metrics', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  const cycle = await engine.runMonitoringCycle();
  assert.ok(['systemSnapshot', 'healthResults', 'heartbeatResults', 'watchdogResult'].every((k) => k in cycle));
  assert.ok(cycle.systemSnapshot.cpu.coreCount > 0);
  await engine.shutdown();
});

test('a real module status transition fires healthChanged/moduleOffline and reaches the AlertDispatcher', async () => {
  const notifyCalls = [];
  const engine = new MonitoringEngine({ notify: async (r) => { notifyCalls.push(r); }, logger: silentLogger });
  engine.registerService({ name: 'execution', category: 'module' });
  let healthy = true;
  engine.registerModuleHealthCheck('execution', async () => ({ status: healthy ? HealthStatus.HEALTHY : HealthStatus.OFFLINE }));

  const events = [];
  engine.eventPublisher.on(MonitoringEventNames.HEALTH_CHANGED, (e) => events.push({ type: 'healthChanged', ...e }));
  engine.eventPublisher.on(MonitoringEventNames.MODULE_OFFLINE, (e) => events.push({ type: 'moduleOffline', ...e }));

  healthy = false;
  await engine.runMonitoringCycle();
  assert.ok(events.some((e) => e.type === 'healthChanged'));
  assert.ok(events.some((e) => e.type === 'moduleOffline'));
  assert.ok(notifyCalls.length > 0);
  await engine.shutdown();
});

test('incident lifecycle and recovery actions work through the engine', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  const events = [];
  engine.eventPublisher.on(MonitoringEventNames.INCIDENT_CREATED, (e) => events.push('created'));
  engine.eventPublisher.on(MonitoringEventNames.INCIDENT_RESOLVED, (e) => events.push('resolved'));

  const incident = engine.incidentManager.createIncident({ severity: 'HIGH', rootCause: 'execution offline', affectedServices: ['execution'] });
  engine.incidentManager.resolveIncident(incident.id, 'restarted');
  assert.deepEqual(events, ['created', 'resolved']);

  let restarted = false;
  engine.registerRecoveryAction({ name: 'restartModule', serviceName: 'execution', execute: async () => { restarted = true; return {}; } });
  const result = await engine.recoveryManager.executeRecovery('restartModule', 'execution');
  assert.equal(result.success, true);
  assert.equal(restarted, true);
  await engine.shutdown();
});

test('a hung service detected by the watchdog triggers an automatic restart attempt', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger }, { heartbeat: { missingThresholdMs: 100 }, watchdog: { hungServiceTimeoutMs: 100 } });
  engine.registerService({ name: 'execution', category: 'module' });
  engine.heartbeat('execution');

  let restartAttempted = false;
  engine.registerRecoveryAction({ name: 'restartModule', serviceName: 'execution', execute: async () => { restartAttempted = true; return {}; } });

  await new Promise((r) => setTimeout(r, 150));
  await engine.runMonitoringCycle();
  assert.equal(restartAttempted, true);
  await engine.shutdown();
});

test('getDashboardData bundles every rollup category', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  engine.registerService({ name: 'execution', category: 'module' });
  const dashboard = engine.getDashboardData();
  assert.ok(['platform', 'module', 'exchange', 'database', 'ai', 'system'].every((k) => k in dashboard));
  await engine.shutdown();
});

test('start()/stop() manage the automatic monitoring interval without throwing', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger }, { healthCheck: { intervalMs: 50 } });
  engine.start();
  await new Promise((r) => setTimeout(r, 120));
  engine.stop();
  await engine.shutdown();
});

test('the engine works fully without a notify function (alerting simply disabled)', async () => {
  const engine = new MonitoringEngine({ logger: silentLogger });
  assert.equal(engine.alertDispatcher, null);
  await assert.doesNotReject(() => engine.runMonitoringCycle());
  await engine.shutdown();
});
