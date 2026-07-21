import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HealthManager } from '../src/HealthManager.js';
import { ServiceRegistry } from '../src/ServiceRegistry.js';
import { ModuleHealthMonitor } from '../src/ModuleHealthMonitor.js';
import { HealthChecker, HealthStatus } from '../src/HealthChecker.js';
import { MonitoringEventPublisher } from '../src/MonitoringEvents.js';
import { createConfig } from '../src/Config.js';

function buildHarness() {
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  const healthChecker = new HealthChecker(createConfig().healthCheck);
  const moduleMonitor = new ModuleHealthMonitor(healthChecker);
  const eventPublisher = new MonitoringEventPublisher();
  const events = [];
  ['healthChanged', 'moduleOffline', 'moduleRecovered'].forEach((e) => eventPublisher.on(e, (payload) => events.push({ event: e, ...payload })));
  const hm = new HealthManager({ serviceRegistry: registry, moduleHealthMonitor: moduleMonitor, eventPublisher });
  return { hm, registry, moduleMonitor, events };
}

test('no event fires when a status check reports the same status already on record', async () => {
  const { hm, moduleMonitor, events } = buildHarness();
  moduleMonitor.registerModule('execution', async () => ({ status: HealthStatus.HEALTHY }));
  await hm.runHealthChecks();
  assert.equal(events.length, 0);
});

test('healthChanged and moduleOffline fire on a real transition to OFFLINE, and the registry updates', async () => {
  const { hm, registry, moduleMonitor, events } = buildHarness();
  let status = HealthStatus.HEALTHY;
  moduleMonitor.registerModule('execution', async () => ({ status }));
  status = HealthStatus.OFFLINE;
  await hm.runHealthChecks();
  assert.ok(events.some((e) => e.event === 'healthChanged'));
  assert.ok(events.some((e) => e.event === 'moduleOffline'));
  assert.equal(registry.get('execution').status, HealthStatus.OFFLINE);
});

test('moduleRecovered fires when a service transitions away from OFFLINE', async () => {
  const { hm, moduleMonitor, events } = buildHarness();
  let status = HealthStatus.OFFLINE;
  moduleMonitor.registerModule('execution', async () => ({ status }));
  await hm.runHealthChecks(); // establishes OFFLINE
  status = HealthStatus.HEALTHY;
  await hm.runHealthChecks();
  assert.ok(events.some((e) => e.event === 'moduleRecovered'));
});

test('an AlertDispatcher, when supplied, is notified of every transition', async () => {
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  const moduleMonitor = new ModuleHealthMonitor(new HealthChecker(createConfig().healthCheck));
  let status = HealthStatus.HEALTHY;
  moduleMonitor.registerModule('execution', async () => ({ status }));
  const alertCalls = [];
  const alertDispatcher = { dispatchHealthChanged: async (...args) => alertCalls.push(args) };
  const hm = new HealthManager({ serviceRegistry: registry, moduleHealthMonitor: moduleMonitor, eventPublisher: new MonitoringEventPublisher(), alertDispatcher });
  status = HealthStatus.CRITICAL;
  await hm.runHealthChecks();
  assert.equal(alertCalls.length, 1);
});

test('registerCheck integrates extra (non-module) checks alongside module checks', async () => {
  const { hm, registry, events } = buildHarness();
  registry.register({ name: 'redis', category: 'database' });
  hm.registerCheck('redis', async () => ({ serviceName: 'redis', status: HealthStatus.CRITICAL, message: '', details: {}, latencyMs: 1, checkedAt: Date.now() }));
  await hm.runHealthChecks();
  assert.ok(events.some((e) => e.serviceName === 'redis' && e.status === HealthStatus.CRITICAL));
});

test('checks for services never registered in ServiceRegistry are safely ignored', async () => {
  const { hm } = buildHarness();
  hm.registerCheck('never-registered', async () => ({ serviceName: 'never-registered', status: HealthStatus.CRITICAL, message: '', details: {}, latencyMs: 1, checkedAt: Date.now() }));
  await assert.doesNotReject(() => hm.runHealthChecks());
});

test('getCurrentStatus reflects the latest known status', async () => {
  const { hm, moduleMonitor } = buildHarness();
  moduleMonitor.registerModule('execution', async () => ({ status: HealthStatus.WARNING }));
  await hm.runHealthChecks();
  assert.equal(hm.getCurrentStatus('execution'), HealthStatus.WARNING);
});
