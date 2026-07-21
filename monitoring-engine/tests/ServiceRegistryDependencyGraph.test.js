import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRegistry } from '../src/ServiceRegistry.js';
import { HealthStatus } from '../src/HealthChecker.js';
import { DependencyGraph } from '../src/DependencyGraph.js';

test('register creates a HEALTHY service and is idempotent on re-registration', () => {
  const registry = new ServiceRegistry();
  const svc = registry.register({ name: 'execution', version: '1.0.0', category: 'module', dependencies: [] });
  assert.equal(svc.status, HealthStatus.HEALTHY);
  const updated = registry.register({ name: 'execution', version: '2.0.0', category: 'module' });
  assert.equal(updated.registeredAt, svc.registeredAt);
  assert.equal(registry.get('execution').version, '2.0.0');
});

test('updateStatus, recordHeartbeat, and recordActivity mutate the correct fields', () => {
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  registry.updateStatus('execution', HealthStatus.WARNING);
  registry.recordHeartbeat('execution', 1000);
  registry.recordActivity('execution', 2000);
  const record = registry.get('execution');
  assert.equal(record.status, HealthStatus.WARNING);
  assert.equal(record.lastHeartbeatAt, 1000);
  assert.equal(record.lastActivityAt, 2000);
});

test('operations on an unregistered service throw', () => {
  const registry = new ServiceRegistry();
  assert.throws(() => registry.updateStatus('nope', HealthStatus.HEALTHY));
});

test('getAll/getByStatus filter correctly, and size/has/unregister work', () => {
  const registry = new ServiceRegistry();
  registry.register({ name: 'a', category: 'module' });
  registry.register({ name: 'b', category: 'exchange' });
  registry.updateStatus('b', HealthStatus.CRITICAL);
  assert.equal(registry.getAll('module').length, 1);
  assert.equal(registry.getByStatus(HealthStatus.CRITICAL).length, 1);
  assert.equal(registry.size, 2);
  assert.equal(registry.has('a'), true);
  assert.equal(registry.unregister('a'), true);
  assert.equal(registry.has('a'), false);
});

test('DependencyGraph tracks direct dependencies and dependents', () => {
  const graph = new DependencyGraph();
  graph.setDependencies('execution', ['binance', 'database']);
  assert.deepEqual(graph.getDependencies('execution').sort(), ['binance', 'database']);
  assert.deepEqual(graph.getDependents('binance'), ['execution']);
});

test('getCascadingImpact finds every transitively-affected service', () => {
  const graph = new DependencyGraph();
  graph.setDependencies('execution', ['binance']);
  graph.setDependencies('position', ['execution']);
  graph.setDependencies('portfolio', ['position']);
  assert.deepEqual(graph.getCascadingImpact('binance').sort(), ['execution', 'portfolio', 'position']);
});

test('detectCycle correctly identifies a real cycle and reports none for a valid DAG', () => {
  const validGraph = new DependencyGraph();
  validGraph.setDependencies('b', ['a']);
  assert.equal(validGraph.detectCycle().hasCycle, false);

  const cyclicGraph = new DependencyGraph();
  cyclicGraph.addDependency('a', 'b');
  cyclicGraph.addDependency('b', 'c');
  cyclicGraph.addDependency('c', 'a');
  assert.equal(cyclicGraph.detectCycle().hasCycle, true);
});

test('setDependencies replaces a previous dependency list cleanly (no stale reverse edges)', () => {
  const graph = new DependencyGraph();
  graph.setDependencies('a', ['b']);
  graph.setDependencies('a', ['c']); // b should no longer be a dependency of a
  assert.deepEqual(graph.getDependencies('a'), ['c']);
  assert.deepEqual(graph.getDependents('b'), []);
});
