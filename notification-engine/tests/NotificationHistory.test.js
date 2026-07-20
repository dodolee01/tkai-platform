import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationHistory } from '../src/NotificationHistory.js';
import { createConfig } from '../src/Config.js';
import { Priority } from '../src/NotificationPriority.js';

function makeNotif(overrides = {}) {
  return { id: 'n1', type: 'tradeOpen', priority: Priority.MEDIUM, userId: 'u1', title: 'Trade Opened', body: 'BTCUSDT LONG', data: {}, channels: ['telegram'], dedupeKey: 'k1', createdAt: Date.now(), ...overrides };
}

test('add() and getById() round-trip a record', () => {
  const history = new NotificationHistory(createConfig().history);
  history.add(makeNotif());
  assert.equal(history.getById('n1').title, 'Trade Opened');
});

test('maxRecords evicts the oldest record once exceeded', () => {
  const history = new NotificationHistory(createConfig({ history: { maxRecords: 2 } }).history);
  history.add(makeNotif({ id: 'n1' }));
  history.add(makeNotif({ id: 'n2' }));
  history.add(makeNotif({ id: 'n3' }));
  assert.equal(history.size, 2);
  assert.equal(history.getById('n1'), undefined);
});

test('query filters by userId, type, priority, and channel independently', () => {
  const history = new NotificationHistory(createConfig().history);
  history.add(makeNotif({ id: 'n1', userId: 'u1', type: 'tradeOpen', priority: Priority.LOW, channels: ['telegram'] }));
  history.add(makeNotif({ id: 'n2', userId: 'u2', type: 'riskWarning', priority: Priority.HIGH, channels: ['discord'] }));
  assert.equal(history.query({ userId: 'u1' }).total, 1);
  assert.equal(history.query({ type: 'riskWarning' }).total, 1);
  assert.equal(history.query({ priority: Priority.HIGH }).total, 1);
  assert.equal(history.query({ channel: 'discord' }).total, 1);
});

test('query filters by a time range (since/until)', () => {
  const history = new NotificationHistory(createConfig().history);
  history.add(makeNotif({ id: 'old', createdAt: 1000 }));
  history.add(makeNotif({ id: 'new', createdAt: 9000 }));
  assert.equal(history.query({ since: 5000 }).total, 1);
  assert.equal(history.query({ until: 5000 }).total, 1);
});

test('query performs a case-insensitive substring search across title and body', () => {
  const history = new NotificationHistory(createConfig().history);
  history.add(makeNotif({ id: 'n1', title: 'Liquidation Risk', body: 'severe' }));
  history.add(makeNotif({ id: 'n2', title: 'Normal trade', body: 'ok' }));
  assert.equal(history.query({ searchText: 'liquidation' }).total, 1);
});

test('pagination returns the correct page and computes totalPages', () => {
  const history = new NotificationHistory(createConfig().history);
  for (let i = 0; i < 5; i++) history.add(makeNotif({ id: `n${i}`, createdAt: i }));
  const page1 = history.query({ pageSize: 2, page: 1 });
  const page2 = history.query({ pageSize: 2, page: 2 });
  assert.equal(page1.records.length, 2);
  assert.equal(page2.records.length, 2);
  assert.equal(page1.totalPages, 3);
  assert.notDeepEqual(page1.records, page2.records);
});

test('export returns the full unpaginated result set for a filter', () => {
  const history = new NotificationHistory(createConfig().history);
  for (let i = 0; i < 100; i++) history.add(makeNotif({ id: `n${i}` }));
  assert.equal(history.export().length, 100);
});

test('clear empties the history', () => {
  const history = new NotificationHistory(createConfig().history);
  history.add(makeNotif());
  history.clear();
  assert.equal(history.size, 0);
});
