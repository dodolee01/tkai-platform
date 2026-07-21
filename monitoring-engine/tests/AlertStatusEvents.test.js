import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlertDispatcher } from '../src/AlertDispatcher.js';
import { StatusAggregator, rollupStatus } from '../src/StatusAggregator.js';
import { ServiceRegistry } from '../src/ServiceRegistry.js';
import { HealthStatus } from '../src/HealthChecker.js';
import { MonitoringEventPublisher, MonitoringEventNames } from '../src/MonitoringEvents.js';

test('AlertDispatcher maps a CRITICAL health status to CRITICAL priority', async () => {
  const captured = [];
  const dispatcher = new AlertDispatcher({ notify: async (r) => { captured.push(r); } });
  await dispatcher.dispatchHealthChanged('execution', 'HEALTHY', 'CRITICAL');
  assert.equal(captured[0].priority, 'CRITICAL');
  assert.equal(captured[0].data.serviceName, 'execution');
});

test('AlertDispatcher dispatchIncidentCreated/Resolved and dispatchServiceRestarted include relevant details', async () => {
  const captured = [];
  const dispatcher = new AlertDispatcher({ notify: async (r) => { captured.push(r); } });
  await dispatcher.dispatchIncidentCreated({ id: 'i1', severity: 'HIGH', rootCause: 'timeout', affectedServices: ['execution'] });
  assert.equal(captured[0].type, 'criticalAlert');
  await dispatcher.dispatchIncidentResolved({ id: 'i1', rootCause: 'timeout', recoveryTimeMs: 3000 });
  assert.ok(captured[1].data.message.includes('3000ms'));
  await dispatcher.dispatchServiceRestarted('risk', 'hung service');
  assert.ok(captured[2].data.message.includes('hung service'));
});

test('AlertDispatcher never propagates a failing notify() call', async () => {
  const dispatcher = new AlertDispatcher({ notify: async () => { throw new Error('down'); } });
  await assert.doesNotReject(() => dispatcher.dispatchHealthChanged('x', 'HEALTHY', 'CRITICAL'));
});

test('AlertDispatcher requires a notify dependency', () => {
  assert.throws(() => new AlertDispatcher({}));
});

test('rollupStatus returns the single most severe status, with OFFLINE outranking CRITICAL', () => {
  assert.equal(rollupStatus([]), HealthStatus.HEALTHY);
  assert.equal(rollupStatus([HealthStatus.HEALTHY, HealthStatus.WARNING, HealthStatus.CRITICAL]), HealthStatus.CRITICAL);
  assert.equal(rollupStatus([HealthStatus.CRITICAL, HealthStatus.OFFLINE]), HealthStatus.OFFLINE);
});

test('StatusAggregator category rollups reflect the worst status in that category', () => {
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  registry.register({ name: 'position', category: 'module' });
  registry.updateStatus('position', HealthStatus.WARNING);
  const aggregator = new StatusAggregator(registry);
  assert.equal(aggregator.getModuleHealth().status, HealthStatus.WARNING);
});

test('StatusAggregator.getPlatformHealth aggregates across all categories with accurate counts', () => {
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  registry.register({ name: 'redis', category: 'database' });
  registry.updateStatus('redis', HealthStatus.CRITICAL);
  const aggregator = new StatusAggregator(registry);
  const platform = aggregator.getPlatformHealth();
  assert.equal(platform.status, HealthStatus.CRITICAL);
  assert.equal(platform.criticalCount, 1);
  assert.equal(platform.totalServices, 2);
});

test('StatusAggregator.getDashboardData bundles every documented rollup', () => {
  const registry = new ServiceRegistry();
  const aggregator = new StatusAggregator(registry);
  const dashboard = aggregator.getDashboardData();
  assert.ok(['platform', 'module', 'exchange', 'database', 'ai', 'system'].every((k) => k in dashboard));
});

test('MonitoringEventNames covers all 8 required events', () => {
  const required = ['healthChanged', 'moduleOffline', 'moduleRecovered', 'incidentCreated', 'incidentResolved', 'serviceRestarted', 'heartbeatLost', 'heartbeatRecovered'];
  const values = Object.values(MonitoringEventNames);
  for (const name of required) assert.ok(values.includes(name), `missing ${name}`);
});

test('MonitoringEventPublisher.safeEmit isolates a throwing listener', () => {
  const bus = new MonitoringEventPublisher();
  let secondRan = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { secondRan = true; });
  assert.doesNotThrow(() => bus.safeEmit('x'));
  assert.equal(secondRan, true);
});
