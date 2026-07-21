import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeartbeatManager } from '../src/HeartbeatManager.js';
import { ServiceRegistry } from '../src/ServiceRegistry.js';
import { MonitoringEventPublisher } from '../src/MonitoringEvents.js';
import { createConfig } from '../src/Config.js';

function buildHarness(configOverrides = {}) {
  let now = 0;
  const registry = new ServiceRegistry();
  registry.register({ name: 'execution', category: 'module' });
  const eventPublisher = new MonitoringEventPublisher();
  const events = [];
  eventPublisher.on('heartbeatLost', (e) => events.push({ type: 'lost', ...e }));
  eventPublisher.on('heartbeatRecovered', (e) => events.push({ type: 'recovered', ...e }));
  const hbm = new HeartbeatManager({ serviceRegistry: registry, eventPublisher }, createConfig(configOverrides).heartbeat, () => now);
  return { hbm, registry, events, setNow: (v) => { now = v; } };
}

test('a beat is accepted and updates the ServiceRegistry heartbeat timestamp', () => {
  const { hbm, registry } = buildHarness();
  const result = hbm.beat('execution');
  assert.equal(result.accepted, true);
  assert.equal(registry.get('execution').lastHeartbeatAt, 0);
});

test('evaluateAll classifies ok/slow/missing correctly against the configured thresholds', () => {
  const { hbm, setNow } = buildHarness({ heartbeat: { slowThresholdMs: 2000, missingThresholdMs: 4000 } });
  hbm.beat('execution');
  setNow(500);
  assert.equal(hbm.evaluateAll()[0].status, 'ok');
  setNow(3000);
  assert.equal(hbm.evaluateAll()[0].status, 'slow');
  setNow(6000);
  assert.equal(hbm.evaluateAll()[0].status, 'missing');
});

test('heartbeatLost fires exactly once when a heartbeat first goes missing', () => {
  const { hbm, events, setNow } = buildHarness({ heartbeat: { missingThresholdMs: 1000 } });
  hbm.beat('execution');
  setNow(2000);
  hbm.evaluateAll();
  hbm.evaluateAll();
  assert.equal(events.filter((e) => e.type === 'lost').length, 1);
});

test('heartbeatRecovered fires when a beat arrives after being marked missing', () => {
  const { hbm, events, setNow } = buildHarness({ heartbeat: { missingThresholdMs: 1000 } });
  hbm.beat('execution');
  setNow(2000);
  hbm.evaluateAll(); // now missing
  hbm.beat('execution');
  assert.ok(events.some((e) => e.type === 'recovered'));
});

test('a stale/duplicate sequence number is rejected', () => {
  const { hbm } = buildHarness();
  hbm.beat('execution', 5);
  const dup = hbm.beat('execution', 3);
  assert.equal(dup.accepted, false);
  assert.equal(dup.reason, 'duplicate heartbeat');
});

test('isMissing reflects the current tracked state', () => {
  const { hbm, setNow } = buildHarness({ heartbeat: { missingThresholdMs: 1000 } });
  hbm.beat('execution');
  assert.equal(hbm.isMissing('execution'), false);
  setNow(2000);
  hbm.evaluateAll();
  assert.equal(hbm.isMissing('execution'), true);
});
