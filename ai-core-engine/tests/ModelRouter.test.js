import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRouter } from '../src/ModelRouter.js';
import { createConfig } from '../src/Config.js';

function makeProvider(name, { costPrompt, costCompletion, latency, supportsTools = true }) {
  return { name, capabilities: { costPerPromptToken: costPrompt, costPerCompletionToken: costCompletion, averageLatencyMs: latency, supportsTools } };
}

function buildProviders() {
  const providers = new Map();
  providers.set('claude', makeProvider('claude', { costPrompt: 0.000003, costCompletion: 0.000015, latency: 1600 }));
  providers.set('deepseek', makeProvider('deepseek', { costPrompt: 0.00000027, costCompletion: 0.0000011, latency: 2000 }));
  providers.set('gemini', makeProvider('gemini', { costPrompt: 0.0000001, costCompletion: 0.0000004, latency: 1300 }));
  return providers;
}

test('cost priority selects the cheapest available provider', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = buildProviders();
  const pick = router.selectProvider(providers, new Set(providers.keys()), { messages: [], routingPriority: 'cost' });
  assert.equal(pick.name, 'gemini');
});

test('latency priority selects the fastest available provider', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = buildProviders();
  const pick = router.selectProvider(providers, new Set(providers.keys()), { messages: [], routingPriority: 'latency' });
  assert.equal(pick.name, 'gemini');
});

test('quality priority selects per the configured rank order', () => {
  const router = new ModelRouter(createConfig({ routing: { qualityRank: ['claude', 'deepseek', 'gemini'] } }).routing);
  const providers = buildProviders();
  const pick = router.selectProvider(providers, new Set(providers.keys()), { messages: [], routingPriority: 'quality' });
  assert.equal(pick.name, 'claude');
});

test('an explicit user preference overrides the routing priority when available', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = buildProviders();
  const pick = router.selectProvider(providers, new Set(providers.keys()), { messages: [], preferredProvider: 'deepseek', routingPriority: 'cost' });
  assert.equal(pick.name, 'deepseek');
});

test('falls back to normal routing when the preferred provider is unavailable', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = buildProviders();
  const pick = router.selectProvider(providers, new Set(['claude', 'gemini']), { messages: [], preferredProvider: 'deepseek', routingPriority: 'cost' });
  assert.equal(pick.name, 'gemini');
});

test('capability filtering excludes providers without tool support when tools are required', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = new Map();
  providers.set('noTools', makeProvider('noTools', { costPrompt: 0.000001, costCompletion: 0.000001, latency: 100, supportsTools: false }));
  providers.set('withTools', makeProvider('withTools', { costPrompt: 0.000002, costCompletion: 0.000002, latency: 100, supportsTools: true }));
  const pick = router.selectProvider(providers, new Set(providers.keys()), { messages: [], tools: [{ name: 'x' }], routingPriority: 'cost' });
  assert.equal(pick.name, 'withTools');
});

test('throws a clear error when no provider is available', () => {
  const router = new ModelRouter(createConfig().routing);
  const providers = buildProviders();
  assert.throws(() => router.selectProvider(providers, new Set(), { messages: [] }), /no available provider/);
});
