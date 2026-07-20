import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { NotificationEngine } from '../src/NotificationEngine.js';
import { Priority } from '../src/NotificationPriority.js';

const silentLogger = { debug(){}, info(){}, warn(){}, error(){}, critical(){}, close: async () => {} };

function makeFakeProvider(channel, { succeed = true } = {}) {
  const calls = [];
  return {
    calls,
    send: async (n) => {
      calls.push(n);
      return succeed
        ? { success: true, channel, providerMessageId: `${channel}-1`, error: null, latencyMs: 10 }
        : { success: false, channel, providerMessageId: null, error: 'simulated failure', latencyMs: 0 };
    },
  };
}

test('notify() -> processNext() delivers a notification end to end', async () => {
  const telegram = makeFakeProvider('telegram');
  const engine = new NotificationEngine({ providers: { telegram }, logger: silentLogger });
  const result = engine.notify({ type: 'tradeOpen', priority: Priority.MEDIUM, channels: ['telegram'], data: { symbol: 'BTCUSDT' } });
  assert.equal(result.queued, true);
  const processed = await engine.processNext();
  assert.equal(processed, true);
  assert.equal(telegram.calls.length, 1);
  assert.equal(engine.history.size, 1);
  await engine.shutdown();
});

test('processNext returns false when the queue is empty', async () => {
  const engine = new NotificationEngine({ providers: {}, logger: silentLogger });
  assert.equal(await engine.processNext(), false);
  await engine.shutdown();
});

test('delivery is recorded in the DeliveryTracker as DELIVERED on success', async () => {
  const telegram = makeFakeProvider('telegram');
  const engine = new NotificationEngine({ providers: { telegram }, logger: silentLogger });
  const { notification } = engine.notify({ type: 'tradeOpen', priority: Priority.MEDIUM, channels: ['telegram'], data: {} });
  await engine.processNext();
  assert.equal(engine.deliveryTracker.get(notification.id, 'telegram').status, 'DELIVERED');
  await engine.shutdown();
});

test('subscribeToEngine maps external events to notification requests', async () => {
  const telegram = makeFakeProvider('telegram');
  const engine = new NotificationEngine({ providers: { telegram }, logger: silentLogger });
  const fakeEmitter = new EventEmitter();

  engine.subscribeToEngine(fakeEmitter, {
    positionClosed: (position) => ({ type: 'tradeClose', userId: position.userId, channels: ['telegram'], data: { symbol: position.symbol, pnl: position.realizedPnl } }),
  });

  fakeEmitter.emit('positionClosed', { userId: 'u1', symbol: 'ETHUSDT', realizedPnl: 100 });
  assert.equal(engine.queue.mainQueueSize, 1);
  await engine.processNext();
  assert.equal(telegram.calls.length, 1);
  await engine.shutdown();
});

test('a mapper returning null skips the notification entirely', async () => {
  const engine = new NotificationEngine({ providers: {}, logger: silentLogger });
  const fakeEmitter = new EventEmitter();
  engine.subscribeToEngine(fakeEmitter, { someEvent: () => null });
  fakeEmitter.emit('someEvent', {});
  assert.equal(engine.queue.mainQueueSize, 0);
  await engine.shutdown();
});

test('a throwing event mapper is caught and logged, never crashes the engine', async () => {
  const engine = new NotificationEngine({ providers: {}, logger: silentLogger });
  const fakeEmitter = new EventEmitter();
  engine.subscribeToEngine(fakeEmitter, { badEvent: () => { throw new Error('mapper bug'); } });
  assert.doesNotThrow(() => fakeEmitter.emit('badEvent', {}));
  await engine.shutdown();
});

test('getMetricsSnapshot and getHealthReport return complete reports', async () => {
  const telegram = makeFakeProvider('telegram');
  const engine = new NotificationEngine({ providers: { telegram }, logger: silentLogger });
  engine.notify({ type: 'tradeOpen', priority: Priority.MEDIUM, channels: ['telegram'], data: {} });
  await engine.processNext();
  const metricsSnapshot = engine.getMetricsSnapshot();
  assert.equal(typeof metricsSnapshot.successRate, 'number');
  const healthReport = engine.getHealthReport();
  assert.ok(['healthy', 'warning', 'critical'].includes(healthReport.status));
  await engine.shutdown();
});

test('start()/stop() drive the queue automatically without manual processNext calls', async () => {
  const telegram = makeFakeProvider('telegram');
  const engine = new NotificationEngine({ providers: { telegram }, logger: silentLogger }, { queue: { delayedCheckIntervalMs: 15 } });
  engine.notify({ type: 'tradeOpen', priority: Priority.LOW, channels: ['telegram'], data: {} });
  engine.start();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(engine.queue.mainQueueSize, 0);
  assert.equal(engine.history.size, 1);
  engine.stop();
  await engine.shutdown();
});

test('a failing channel with exhausted retries still allows history/repository persistence to proceed', async () => {
  const failing = makeFakeProvider('telegram', { succeed: false });
  const engine = new NotificationEngine({ providers: { telegram: failing }, logger: silentLogger }, { retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5 } });
  engine.notify({ type: 'tradeOpen', priority: Priority.MEDIUM, channels: ['telegram'], data: {} });
  await engine.processNext();
  assert.equal(engine.history.size, 1); // history still recorded despite delivery failure
  assert.equal(engine.queue.deadLetterQueueSize, 1);
  await engine.shutdown();
});

test('multi-channel routing by priority delivers CRITICAL notifications to every configured channel', async () => {
  const telegram = makeFakeProvider('telegram');
  const discord = makeFakeProvider('discord');
  const email = makeFakeProvider('email');
  const sms = makeFakeProvider('sms');
  const engine = new NotificationEngine({ providers: { telegram, discord, email, sms }, logger: silentLogger });
  engine.notify({ type: 'criticalAlert', data: { message: 'Emergency' } });
  await engine.processNext();
  assert.equal(telegram.calls.length, 1);
  assert.equal(discord.calls.length, 1);
  assert.equal(email.calls.length, 1);
  assert.equal(sms.calls.length, 1);
  await engine.shutdown();
});
