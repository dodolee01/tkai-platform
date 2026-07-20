import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationManager } from '../src/NotificationManager.js';
import { AlertRules } from '../src/AlertRules.js';
import { AlertTemplates } from '../src/AlertTemplates.js';
import { DeduplicationEngine } from '../src/DeduplicationEngine.js';
import { RateLimiter } from '../src/RateLimiter.js';
import { NotificationQueue } from '../src/NotificationQueue.js';
import { createConfig } from '../src/Config.js';
import { Priority } from '../src/NotificationPriority.js';

function buildManager(config = createConfig(), overrides = {}) {
  const queue = new NotificationQueue();
  const mgr = new NotificationManager({
    alertRules: new AlertRules(),
    alertTemplates: new AlertTemplates(),
    deduplicationEngine: new DeduplicationEngine(config.deduplication),
    rateLimiter: new RateLimiter(config.rateLimiter),
    queue,
    ...overrides,
  }, config);
  return { mgr, queue };
}

test('submit resolves priority, renders the template, and enqueues', () => {
  const { mgr, queue } = buildManager();
  const result = mgr.submit({ type: 'liquidationWarning', userId: 'u1', data: { symbol: 'BTCUSDT', distancePct: 1, liquidationPrice: 60000 } });
  assert.equal(result.queued, true);
  assert.equal(result.notification.priority, Priority.CRITICAL);
  assert.ok(result.notification.title.includes('LIQUIDATION'));
  assert.equal(queue.mainQueueSize, 1);
});

test('a duplicate submission within the dedup window is suppressed', () => {
  const { mgr, queue } = buildManager();
  mgr.submit({ type: 'tradeOpen', userId: 'u1', data: { symbol: 'BTCUSDT' } });
  const dup = mgr.submit({ type: 'tradeOpen', userId: 'u1', data: { symbol: 'BTCUSDT' } });
  assert.equal(dup.queued, false);
  assert.ok(dup.reason.includes('duplicate'));
  assert.equal(queue.mainQueueSize, 1);
});

test('different data (different dedupe key) is not treated as a duplicate', () => {
  const { mgr, queue } = buildManager();
  mgr.submit({ type: 'tradeOpen', userId: 'u1', data: { symbol: 'BTCUSDT' } });
  mgr.submit({ type: 'tradeOpen', userId: 'u1', data: { symbol: 'ETHUSDT' } });
  assert.equal(queue.mainQueueSize, 2);
});

test('rate-limited channels are excluded from the resolved notification', () => {
  const config = createConfig({ rateLimiter: { perMinute: 1, perHour: 1000, perDay: 10000 } });
  const { mgr } = buildManager(config);
  mgr.submit({ type: 'tradeOpen', priority: Priority.LOW, userId: 'u1', data: { symbol: 'A' } }); // consumes inApp's 1 slot
  const second = mgr.submit({ type: 'tradeOpen', priority: Priority.LOW, userId: 'u1', data: { symbol: 'B' } });
  assert.equal(second.queued, false);
  assert.ok(second.reason.includes('rate-limited'));
});

test('an explicit priority and channel override are both respected', () => {
  const { mgr } = buildManager();
  const result = mgr.submit({ type: 'tradeOpen', priority: Priority.CRITICAL, channels: ['webhook'], data: { symbol: 'X' } });
  assert.equal(result.notification.priority, Priority.CRITICAL);
  assert.deepEqual(result.notification.channels, ['webhook']);
});

test('the notification data is preserved unmodified on the resolved notification', () => {
  const { mgr } = buildManager();
  const data = { symbol: 'BTCUSDT', entryPrice: 65000 };
  const result = mgr.submit({ type: 'tradeOpen', data });
  assert.deepEqual(result.notification.data, data);
});
