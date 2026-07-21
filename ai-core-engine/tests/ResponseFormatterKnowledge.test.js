import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJSONBlock, stripMarkdown, truncate, formatAnalysisResult } from '../src/ResponseFormatter.js';
import { KnowledgeManager } from '../src/KnowledgeManager.js';

test('extractJSONBlock parses a fenced JSON block', () => {
  const text = 'Here:\n```json\n{"a": 1}\n```';
  assert.deepEqual(extractJSONBlock(text), { a: 1 });
});

test('extractJSONBlock returns null for non-JSON text', () => {
  assert.equal(extractJSONBlock('just plain text'), null);
});

test('stripMarkdown removes formatting characters and code fences', () => {
  assert.equal(stripMarkdown('**bold** and `code`'), 'bold and code');
  assert.ok(!stripMarkdown('text\n```js\ncode\n```\nmore').includes('code'));
});

test('truncate leaves short text unchanged and cuts long text with an ellipsis', () => {
  assert.equal(truncate('short', 100), 'short');
  assert.equal(truncate('a'.repeat(100), 10).length, 10);
});

test('formatAnalysisResult separates the natural-language summary from a structured JSON block', () => {
  const text = 'Summary text.\n```json\n{"symbol": "BTCUSDT"}\n```';
  const result = formatAnalysisResult(text, 0.8);
  assert.equal(result.data.symbol, 'BTCUSDT');
  assert.ok(result.summary.includes('Summary text'));
});

test('formatAnalysisResult clamps confidence to [0, 1]', () => {
  assert.equal(formatAnalysisResult('x', 1.5).confidence, 1);
  assert.equal(formatAnalysisResult('x', -0.5).confidence, 0);
});

test('KnowledgeManager addEntry/getEntry/removeEntry round-trip correctly', () => {
  const km = new KnowledgeManager();
  km.addEntry('k1', 'Leverage', 'Amplifies gains and losses.', ['risk']);
  assert.equal(km.getEntry('k1').topic, 'Leverage');
  assert.equal(km.size, 1);
  assert.equal(km.removeEntry('k1'), true);
  assert.equal(km.size, 0);
});

test('KnowledgeManager.search matches topic, content, and tags case-insensitively', () => {
  const km = new KnowledgeManager();
  km.addEntry('k1', 'Leverage', 'Amplifies gains and losses.', ['risk', 'basics']);
  assert.equal(km.search('LEVERAGE').length, 1);
  assert.equal(km.search('amplifies').length, 1);
  assert.equal(km.search('basics').length, 1);
  assert.equal(km.search('nonexistent').length, 0);
});

test('KnowledgeManager.getByTag filters correctly', () => {
  const km = new KnowledgeManager();
  km.addEntry('k1', 'A', 'x', ['risk']);
  km.addEntry('k2', 'B', 'y', ['risk', 'orders']);
  assert.equal(km.getByTag('risk').length, 2);
  assert.equal(km.getByTag('orders').length, 1);
});
