import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IncidentManager } from '../src/IncidentManager.js';
import { MonitoringEventPublisher } from '../src/MonitoringEvents.js';

function buildHarness() {
  let now = 0;
  const eventPublisher = new MonitoringEventPublisher();
  const events = [];
  eventPublisher.on('incidentCreated', (i) => events.push({ type: 'created', ...i }));
  eventPublisher.on('incidentResolved', (i) => events.push({ type: 'resolved', ...i }));
  const im = new IncidentManager(eventPublisher, () => now);
  return { im, events, setNow: (v) => { now = v; } };
}

test('createIncident returns an OPEN incident and fires incidentCreated', () => {
  const { im, events } = buildHarness();
  const incident = im.createIncident({ severity: 'HIGH', rootCause: 'Binance timeout', affectedServices: ['execution'] });
  assert.equal(incident.state, 'OPEN');
  assert.equal(events.some((e) => e.type === 'created' && e.id === incident.id), true);
});

test('resolveIncident computes recoveryTimeMs and fires incidentResolved', () => {
  const { im, events, setNow } = buildHarness();
  const incident = im.createIncident({ severity: 'HIGH', rootCause: 'x', affectedServices: [] });
  setNow(5000);
  const resolved = im.resolveIncident(incident.id, 'fixed');
  assert.equal(resolved.recoveryTimeMs, 5000);
  assert.equal(resolved.state, 'RESOLVED');
  assert.ok(events.some((e) => e.type === 'resolved'));
});

test('resolving twice or an unknown incident throws', () => {
  const { im } = buildHarness();
  const incident = im.createIncident({ severity: 'LOW', rootCause: 'x', affectedServices: [] });
  im.resolveIncident(incident.id, 'fixed');
  assert.throws(() => im.resolveIncident(incident.id, 'again'));
  assert.throws(() => im.resolveIncident('fake-id', 'x'));
});

test('getOpenIncidents and getOpenIncidentsForService filter correctly', () => {
  const { im } = buildHarness();
  const i1 = im.createIncident({ severity: 'HIGH', rootCause: 'a', affectedServices: ['execution'] });
  im.createIncident({ severity: 'LOW', rootCause: 'b', affectedServices: ['portfolio'] });
  assert.equal(im.getOpenIncidents().length, 2);
  assert.equal(im.getOpenIncidentsForService('execution').length, 1);
  im.resolveIncident(i1.id, 'fixed');
  assert.equal(im.getOpenIncidents().length, 1);
});

test('getAverageRecoveryTimeMs computes the mean across resolved incidents', () => {
  const { im, setNow } = buildHarness();
  const i1 = im.createIncident({ severity: 'HIGH', rootCause: 'a', affectedServices: [] });
  setNow(5000);
  im.resolveIncident(i1.id, 'fixed');
  const i2 = im.createIncident({ severity: 'LOW', rootCause: 'b', affectedServices: [] });
  setNow(8000);
  im.resolveIncident(i2.id, 'fixed');
  assert.equal(im.getAverageRecoveryTimeMs(), (5000 + 3000) / 2);
});

test('getAverageRecoveryTimeMs returns 0 with no resolved incidents', () => {
  const { im } = buildHarness();
  assert.equal(im.getAverageRecoveryTimeMs(), 0);
});
