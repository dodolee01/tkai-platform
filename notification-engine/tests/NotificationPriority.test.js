import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Priority, priorityRank, comparePriority, resolveChannels } from '../src/NotificationPriority.js';
import { createConfig } from '../src/Config.js';

test('priorityRank orders CRITICAL as most severe (0) and INFO as least', () => {
  assert.equal(priorityRank(Priority.CRITICAL), 0);
  assert.equal(priorityRank(Priority.INFO), 4);
});

test('priorityRank throws on an unknown priority', () => {
  assert.throws(() => priorityRank('NOT_REAL'));
});

test('comparePriority sorts an array from most to least severe', () => {
  const arr = [Priority.LOW, Priority.CRITICAL, Priority.MEDIUM];
  arr.sort(comparePriority);
  assert.deepEqual(arr, [Priority.CRITICAL, Priority.MEDIUM, Priority.LOW]);
});

test('resolveChannels returns the configured channel list for a priority', () => {
  const config = createConfig().routing;
  assert.deepEqual(resolveChannels(Priority.CRITICAL, config), ['telegram', 'discord', 'sms', 'email']);
  assert.deepEqual(resolveChannels(Priority.LOW, config), ['inApp']);
});

test('resolveChannels falls back to DEFAULT for an unrouted priority', () => {
  const config = { DEFAULT: ['inApp'] };
  assert.deepEqual(resolveChannels('SOMETHING_ELSE', config), ['inApp']);
});
