import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AICoreEngine } from '../src/AICoreEngine.js';
import { AIEventNames } from '../src/AIEvents.js';

function makeFakeProvider(name = 'claude') {
  return {
    name,
    capabilities: { maxContextTokens: 200000, supportsTools: true, supportsStreaming: true, supportsVision: true, costPerPromptToken: 0.000003, costPerCompletionToken: 0.000015, averageLatencyMs: 1000 },
    complete: async (req) => {
      const lastUserMsg = [...req.messages].reverse().find((m) => m.role === 'user');
      return {
        content: `Response to: ${lastUserMsg.content.slice(0, 50)}`,
        toolCalls: [], provider: name, model: 'x',
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        estimatedCostUsd: 0.0005, latencyMs: 800, cached: false,
      };
    },
  };
}

test('startConversation creates a conversation and fires conversationCreated', () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  const events = [];
  engine.eventPublisher.on(AIEventNames.CONVERSATION_CREATED, (c) => events.push(c));
  const conv = engine.startConversation('u1');
  assert.equal(typeof conv.id, 'string');
  assert.equal(events.length, 1);
});

test('chat() sends the message, gets a reply, and records both turns in history', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  const conv = engine.startConversation('u1');
  const response = await engine.chat(conv.id, 'What is my portfolio risk?', { userId: 'u1' });
  assert.ok(response.content.includes('What is my portfolio risk'));
  assert.equal(engine.conversationManager.getHistory(conv.id).length, 2);
});

test('chat() with contextSources pulls from registered context and works end to end', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  engine.registerContextSource('portfolio', async () => ({ equity: 10000 }));
  const conv = engine.startConversation('u1');
  const response = await engine.chat(conv.id, 'Analyze my exposure', { userId: 'u1', contextSources: ['portfolio'] });
  assert.ok(response.content.length > 0);
});

test('marketAnalyzer, portfolioAdvisor, and strategyAdvisor are wired and functional through the engine', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  const marketResult = await engine.marketAnalyzer.analyze('BTCUSDT', { trend: 'up' }, 'u1');
  assert.ok(marketResult.summary.length > 0);
  const portfolioResult = await engine.portfolioAdvisor.advise({ equity: 10000 }, 'u1');
  assert.ok(portfolioResult.summary.length > 0);
  const strategyResult = await engine.strategyAdvisor.suggest('a grid bot', {}, 'u1');
  assert.ok(strategyResult.summary.length > 0);
});

test('buildBotConfig converts natural language into a structured config object', async () => {
  const botProvider = {
    ...makeFakeProvider(),
    complete: async () => ({
      content: '```json\n{"symbol":"BTCUSDT","strategyType":"scalping","timeframe":"1m","riskPerTradePct":1,"maxLeverage":5,"rationale":"tight scalps"}\n```',
      toolCalls: [], provider: 'claude', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 10, cached: false,
    }),
  };
  const engine = new AICoreEngine({ providers: [botProvider] });
  const result = await engine.buildBotConfig('I want a BTC scalping bot', 'u1');
  assert.equal(result.config.symbol, 'BTCUSDT');
  assert.equal(result.config.strategyType, 'scalping');
});

test('token usage and cost tracking flow through the engine after real completions', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  const conv = engine.startConversation('u1');
  await engine.chat(conv.id, 'unique tracking test message', { userId: 'u1' });
  assert.ok(engine.tokenManager.getTotals().totalTokens > 0);
  assert.ok(engine.costManager.getTotalCostUsd() > 0);
});

test('registerProvider adds a provider after construction', () => {
  const engine = new AICoreEngine();
  engine.registerProvider(makeFakeProvider('openai'));
  assert.ok(engine.providerManager.getAvailableNames().has('openai'));
});

test('aiRequestStarted and aiRequestCompleted fire for every AI call made through any subsystem', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  const events = [];
  engine.eventPublisher.on(AIEventNames.AI_REQUEST_STARTED, () => events.push('started'));
  engine.eventPublisher.on(AIEventNames.AI_REQUEST_COMPLETED, () => events.push('completed'));
  await engine.marketAnalyzer.analyze('BTCUSDT', { trend: 'up' }, 'u1');
  assert.deepEqual(events, ['started', 'completed']);
});

test('shutdown resolves cleanly without throwing', async () => {
  const engine = new AICoreEngine({ providers: [makeFakeProvider()] });
  await assert.doesNotReject(() => engine.shutdown());
});
