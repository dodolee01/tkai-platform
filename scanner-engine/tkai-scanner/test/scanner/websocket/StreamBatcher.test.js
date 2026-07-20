import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchStreams, distributeEvenly } from '../../../src/scanner/websocket/StreamBatcher.js';

test('batchStreams splits into correctly sized chunks with a remainder', () => {
  const batches = batchStreams(['a', 'b', 'c', 'd', 'e'], 2);
  assert.deepEqual(batches, [['a', 'b'], ['c', 'd'], ['e']]);
});

test('batchStreams handles an empty input', () => {
  assert.deepEqual(batchStreams([], 10), []);
});

test('batchStreams throws on an invalid batchSize', () => {
  assert.throws(() => batchStreams(['a'], 0));
  assert.throws(() => batchStreams(['a'], -1));
});

test('distributeEvenly spreads symbols round-robin across groups', () => {
  const groups = distributeEvenly(['s1', 's2', 's3', 's4', 's5'], 2);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].length + groups[1].length, 5);
  assert.deepEqual(groups[0], ['s1', 's3', 's5']);
  assert.deepEqual(groups[1], ['s2', 's4']);
});

test('distributeEvenly throws on an invalid groupCount', () => {
  assert.throws(() => distributeEvenly(['a'], 0));
});
