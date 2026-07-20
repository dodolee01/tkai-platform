import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationRepository, InMemoryNotificationRepository } from '../src/NotificationRepository.js';
import { Priority } from '../src/NotificationPriority.js';

function makeNotif(overrides = {}) {
  return { id: 'n1', type: 'tradeOpen', priority: Priority.MEDIUM, userId: 'u1', title: 'x', body: 'y', data: {}, channels: [], dedupeKey: 'k', createdAt: Date.now(), ...overrides };
}

test('NotificationRepository cannot be instantiated directly', () => {
  assert.throws(() => new NotificationRepository());
});

test('an incomplete subclass rejects with a clear not-implemented message', async () => {
  class Incomplete extends NotificationRepository {}
  await assert.rejects(() => new Incomplete().save({}), /does not implement/);
});

test('save + getById round-trip', async () => {
  const repo = new InMemoryNotificationRepository();
  await repo.save(makeNotif());
  assert.equal((await repo.getById('n1')).title, 'x');
  assert.equal(await repo.getById('nope'), null);
});

test('query filters by userId and type', async () => {
  const repo = new InMemoryNotificationRepository();
  await repo.save(makeNotif({ id: 'n1', userId: 'u1', type: 'tradeOpen' }));
  await repo.save(makeNotif({ id: 'n2', userId: 'u2', type: 'riskWarning' }));
  assert.equal((await repo.query({ userId: 'u1' })).length, 1);
  assert.equal((await repo.query({ type: 'riskWarning' })).length, 1);
});

test('saveDeliveryRecord + getDeliveryRecords round-trip', async () => {
  const repo = new InMemoryNotificationRepository();
  await repo.saveDeliveryRecord({ notificationId: 'n1', channel: 'telegram', status: 'DELIVERED' });
  assert.equal((await repo.getDeliveryRecords()).length, 1);
});
