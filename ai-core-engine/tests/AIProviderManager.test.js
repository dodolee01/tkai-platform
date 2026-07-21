import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderManager } from '../src/AIProviderManager.js';
import { AIEventPublisher } from '../src/AIEvents.js';

function makeProvider(name) {
  return { name, capabilities: { averageLatencyMs: 1000 } };
}

test('register adds a provider to getAll and marks it available', () => {
  const mgr = new AIProviderManager();
  mgr.register(makeProvider('claude'));
  assert.ok(mgr.getAll().has('claude'));
  assert.ok(mgr.getAvailableNames().has('claude'));
});

test('reportSuccess updates the rolling average latency via EMA', () => {
  const mgr = new AIProviderManager();
  const provider = makeProvider('claude');
  mgr.register(provider);
  mgr.reportSuccess('claude', 500);
  assert.equal(provider.capabilities.averageLatencyMs, 1000 * 0.7 + 500 * 0.3);
});

test('a provider becomes unavailable after 3 consecutive failures and providerChanged fires', () => {
  const bus = new AIEventPublisher();
  const events = [];
  bus.on('providerChanged', (e) => events.push(e));
  const mgr = new AIProviderManager(bus);
  mgr.register(makeProvider('claude'));

  mgr.reportFailure('claude', 'timeout');
  mgr.reportFailure('claude', 'timeout');
  assert.ok(mgr.getAvailableNames().has('claude')); // still available at 2 failures

  mgr.reportFailure('claude', 'timeout');
  assert.ok(!mgr.getAvailableNames().has('claude'));
  assert.ok(events.some((e) => e.provider === 'claude' && e.available === false));
});

test('a success resets the failure streak and restores availability', () => {
  const bus = new AIEventPublisher();
  const events = [];
  bus.on('providerChanged', (e) => events.push(e));
  const mgr = new AIProviderManager(bus);
  mgr.register(makeProvider('claude'));
  mgr.reportFailure('claude', 'x');
  mgr.reportFailure('claude', 'x');
  mgr.reportFailure('claude', 'x');
  mgr.reportSuccess('claude', 400);
  assert.ok(mgr.getAvailableNames().has('claude'));
  assert.equal(mgr.getHealth('claude').consecutiveFailures, 0);
  assert.ok(events.some((e) => e.provider === 'claude' && e.available === true));
});

test('getHealth returns undefined for an unregistered provider', () => {
  const mgr = new AIProviderManager();
  assert.equal(mgr.getHealth('nope'), undefined);
});

test('a custom maxConsecutiveFailures threshold is respected', () => {
  const mgr = new AIProviderManager();
  mgr.register(makeProvider('claude'));
  mgr.reportFailure('claude', 'x', 1);
  assert.ok(!mgr.getAvailableNames().has('claude'));
});
