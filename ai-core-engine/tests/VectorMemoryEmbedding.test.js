import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddingManager } from '../src/EmbeddingManager.js';
import { VectorMemory, InMemoryVectorMemory, cosineSimilarity } from '../src/VectorMemory.js';
import { createConfig } from '../src/Config.js';

test('cosineSimilarity computes known geometric cases correctly', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [-1, -1]) + 1) < 1e-9);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0); // mismatched lengths
});

test('EmbeddingManager requires an embed dependency and validates output', async () => {
  assert.throws(() => new EmbeddingManager({}));
  const emBad = new EmbeddingManager({ embed: async () => [] });
  await assert.rejects(() => emBad.embedText('x'), /non-empty numeric array/);
});

test('EmbeddingManager.embedText rejects empty input and embedBatch maps over inputs', async () => {
  const em = new EmbeddingManager({ embed: async (t) => t.split('').map((c) => c.charCodeAt(0)) });
  await assert.rejects(() => em.embedText(''), /non-empty/);
  const batch = await em.embedBatch(['a', 'bb']);
  assert.equal(batch.length, 2);
});

test('VectorMemory cannot be instantiated directly', () => {
  assert.throws(() => new VectorMemory());
});

test('an incomplete VectorMemory subclass rejects with a clear not-implemented message', async () => {
  class Incomplete extends VectorMemory {}
  await assert.rejects(() => new Incomplete().upsert('a', [1]), /does not implement/);
});

test('InMemoryVectorMemory.search returns topK results sorted by similarity, with metadata', async () => {
  const vm = new InMemoryVectorMemory(createConfig({ vectorMemory: { maxVectors: 10, defaultTopK: 2 } }).vectorMemory);
  await vm.upsert('a', [1, 0, 0], { label: 'A' });
  await vm.upsert('b', [0.9, 0.1, 0], { label: 'B' });
  await vm.upsert('c', [0, 1, 0], { label: 'C' });
  const results = await vm.search([1, 0, 0], 2);
  assert.equal(results.length, 2);
  assert.equal(results[0].id, 'a');
  assert.equal(results[0].metadata.label, 'A');
});

test('InMemoryVectorMemory respects the configured default topK when unspecified', async () => {
  const vm = new InMemoryVectorMemory(createConfig({ vectorMemory: { maxVectors: 10, defaultTopK: 1 } }).vectorMemory);
  await vm.upsert('a', [1, 0], {});
  await vm.upsert('b', [0, 1], {});
  assert.equal((await vm.search([1, 0])).length, 1);
});

test('InMemoryVectorMemory evicts the oldest entry once maxVectors is exceeded', async () => {
  const vm = new InMemoryVectorMemory(createConfig({ vectorMemory: { maxVectors: 2, defaultTopK: 5 } }).vectorMemory);
  await vm.upsert('a', [1, 0], {});
  await vm.upsert('b', [0, 1], {});
  await vm.upsert('c', [1, 1], {});
  assert.equal(vm.size, 2);
  const results = await vm.search([1, 0], 5);
  assert.ok(!results.some((r) => r.id === 'a'));
});

test('InMemoryVectorMemory.delete removes an entry and reports success/failure correctly', async () => {
  const vm = new InMemoryVectorMemory(createConfig().vectorMemory);
  await vm.upsert('a', [1, 0], {});
  assert.equal(await vm.delete('a'), true);
  assert.equal(await vm.delete('a'), false);
});
