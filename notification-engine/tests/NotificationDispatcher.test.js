import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationDispatcher } from '../src/NotificationDispatcher.js';
import { DeliveryTracker, DeliveryStatus } from '../src/DeliveryTracker.js';
import { RetryManager } from '../src/RetryManager.js';
import { NotificationQueue } from '../src/NotificationQueue.js';
import { Metrics } from '../src/Metrics.js';
import { createConfig } from '../src/Config.js';
import { Priority } from '../src/NotificationPriority.js';

function makeNotif(overrides = {}) {
  return { id: 'n1', priority: Priority.HIGH, title: 'x', body: 'y', channels: ['telegram'], createdAt: Date.now(), ...overrides };
}

function buildHarness(providers, retryOverrides = {}) {
  const config = createConfig({ retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5, ...retryOverrides } });
  const deliveryTracker = new DeliveryTracker();
  const queue = new NotificationQueue();
  const metrics = new Metrics(config.metrics);
  const dispatcher = new NotificationDispatcher({ providers, deliveryTracker, retryManager: new RetryManager(config.retry, async () => {}), queue, metrics });
  return { dispatcher, deliveryTracker, queue, metrics };
}

test('a successful single-channel dispatch reaches DELIVERED', async () => {
  const providers = { telegram: { send: async () => ({ success: true, channel: 'telegram', providerMessageId: 'm1', error: null, latencyMs: 10 }) } };
  const { dispatcher, deliveryTracker } = buildHarness(providers);
  const results = await dispatcher.dispatch(makeNotif());
  assert.equal(results[0].success, true);
  assert.equal(deliveryTracker.get('n1', 'telegram').status, DeliveryStatus.DELIVERED);
});

test('failures on one channel do not affect another channel of the same notification', async () => {
  const providers = {
    telegram: { send: async () => ({ success: true, channel: 'telegram', providerMessageId: 'm1', error: null, latencyMs: 5 }) },
    discord: { send: async () => ({ success: false, channel: 'discord', providerMessageId: null, error: 'down', latencyMs: 0 }) },
  };
  const { dispatcher } = buildHarness(providers);
  const results = await dispatcher.dispatch(makeNotif({ channels: ['telegram', 'discord'] }));
  assert.equal(results.find((r) => r.channel === 'telegram').success, true);
  assert.equal(results.find((r) => r.channel === 'discord').success, false);
});

test('a permanently failing channel exhausts retries and lands in the dead letter queue', async () => {
  let attempts = 0;
  const providers = { telegram: { send: async () => { attempts++; return { success: false, channel: 'telegram', providerMessageId: null, error: 'nope', latencyMs: 0 }; } } };
  const { dispatcher, queue, deliveryTracker } = buildHarness(providers);
  await dispatcher.dispatch(makeNotif());
  assert.equal(attempts, 2); // maxAttempts from harness config
  assert.equal(queue.deadLetterQueueSize, 1);
  assert.equal(deliveryTracker.get('n1', 'telegram').status, DeliveryStatus.EXPIRED);
});

test('a transient failure that recovers within maxAttempts reaches DELIVERED', async () => {
  let attempts = 0;
  const providers = { telegram: { send: async () => { attempts++; if (attempts < 2) return { success: false, error: 'flaky' }; return { success: true, channel: 'telegram', providerMessageId: 'm2', error: null, latencyMs: 15 }; } } };
  const { dispatcher, deliveryTracker } = buildHarness(providers, { maxAttempts: 3 });
  const results = await dispatcher.dispatch(makeNotif());
  assert.equal(results[0].success, true);
  assert.equal(deliveryTracker.get('n1', 'telegram').status, DeliveryStatus.DELIVERED);
});

test('a missing provider for a channel fails that channel gracefully without throwing', async () => {
  const { dispatcher } = buildHarness({});
  const results = await dispatcher.dispatch(makeNotif({ channels: ['nonexistent'] }));
  assert.equal(results[0].success, false);
  assert.ok(results[0].error.includes('no provider'));
});

test('metrics record both successful and failed deliveries per channel', async () => {
  const providers = { telegram: { send: async () => ({ success: true, channel: 'telegram', providerMessageId: 'm', error: null, latencyMs: 20 }) } };
  const { dispatcher, metrics } = buildHarness(providers);
  await dispatcher.dispatch(makeNotif());
  assert.equal(metrics.getProviderPerformance().telegram.success, 1);
});
