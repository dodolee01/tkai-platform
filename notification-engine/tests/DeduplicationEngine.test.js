import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeduplicationEngine, computeDedupeKey } from '../src/DeduplicationEngine.js';
import { createConfig } from '../src/Config.js';

test('computeDedupeKey is deterministic for identical requests', () => {
  const req = { type: 'liquidationWarning', userId: 'u1', data: { symbol: 'BTCUSDT' } };
  assert.equal(computeDedupeKey(req), computeDedupeKey({ ...req }));
});

test('computeDedupeKey differs when symbol or type differs', () => {
  const req = { type: 'liquidationWarning', userId: 'u1', data: { symbol: 'BTCUSDT' } };
  assert.notEqual(computeDedupeKey(req), computeDedupeKey({ ...req, data: { symbol: 'ETHUSDT' } }));
  assert.notEqual(computeDedupeKey(req), computeDedupeKey({ ...req, type: 'marginWarning' }));
});

test('first occurrence of a key is not a duplicate', () => {
  const dedup = new DeduplicationEngine(createConfig().deduplication);
  const result = dedup.check('key1');
  assert.equal(result.isDuplicate, false);
  assert.equal(result.occurrenceCount, 1);
});

test('repeated occurrences within the window are duplicates with an incrementing count', () => {
  const dedup = new DeduplicationEngine(createConfig().deduplication);
  dedup.check('key1');
  const second = dedup.check('key1');
  const third = dedup.check('key1');
  assert.equal(second.isDuplicate, true);
  assert.equal(second.occurrenceCount, 2);
  assert.equal(third.occurrenceCount, 3);
});

test('occurrences outside the window are treated as fresh, not duplicates', () => {
  let now = 0;
  const dedup = new DeduplicationEngine(createConfig({ deduplication: { windowMs: 1000 } }).deduplication, () => now);
  dedup.check('key1');
  now = 2000;
  const result = dedup.check('key1');
  assert.equal(result.isDuplicate, false);
  assert.equal(result.occurrenceCount, 1);
});

test('reset clears all tracked keys', () => {
  const dedup = new DeduplicationEngine(createConfig().deduplication);
  dedup.check('key1');
  dedup.reset();
  assert.equal(dedup.getEntry('key1'), undefined);
});

test('maxTrackedKeys evicts the least-recently-seen entries under pressure', () => {
  const dedup = new DeduplicationEngine(createConfig({ deduplication: { maxTrackedKeys: 2, windowMs: 100000 } }).deduplication);
  dedup.check('a');
  dedup.check('b');
  dedup.check('c'); // triggers eviction of the oldest ('a')
  assert.equal(dedup.getEntry('a'), undefined);
  assert.notEqual(dedup.getEntry('c'), undefined);
});
