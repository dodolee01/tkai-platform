import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenManager, estimateTokens, estimateMessagesTokens } from '../src/TokenManager.js';
import { createConfig } from '../src/Config.js';

test('estimateTokens applies the configured chars-per-token heuristic', () => {
  assert.equal(estimateTokens('a'.repeat(40), 4), 10);
  assert.equal(estimateTokens('', 4), 0);
});

test('estimateMessagesTokens sums the estimate across every message', () => {
  const messages = [{ role: 'user', content: 'a'.repeat(8) }, { role: 'assistant', content: 'b'.repeat(4) }];
  assert.equal(estimateMessagesTokens(messages, 4), 3);
});

test('recordUsage accumulates totals, per-user, and per-provider correctly', () => {
  const tm = new TokenManager(createConfig().tokens);
  tm.recordUsage({ userId: 'u1', provider: 'claude', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } });
  tm.recordUsage({ userId: 'u1', provider: 'openai', usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 } });
  tm.recordUsage({ userId: 'u2', provider: 'claude', usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } });

  assert.equal(tm.getTotals().totalTokens, 190);
  assert.equal(tm.getUserUsage('u1').totalTokens, 180);
  assert.equal(tm.getProviderUsage('claude').totalTokens, 160);
});

test('recordUsage without a userId still updates provider and global totals', () => {
  const tm = new TokenManager(createConfig().tokens);
  tm.recordUsage({ provider: 'claude', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
  assert.equal(tm.getTotals().totalTokens, 15);
  assert.equal(tm.getProviderUsage('claude').totalTokens, 15);
});

test('unknown user/provider return zeroed usage, not undefined', () => {
  const tm = new TokenManager(createConfig().tokens);
  assert.deepEqual(tm.getUserUsage('nobody'), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
});

test('instance estimate() and estimateMessages() delegate to the module-level helpers', () => {
  const tm = new TokenManager(createConfig().tokens);
  assert.equal(tm.estimate('a'.repeat(8)), estimateTokens('a'.repeat(8), 4));
});
