import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarketAnalyzer } from '../src/MarketAnalyzer.js';
import { PortfolioAdvisor } from '../src/PortfolioAdvisor.js';
import { RiskAdvisor } from '../src/RiskAdvisor.js';
import { TradeAdvisor } from '../src/TradeAdvisor.js';
import { StrategyAdvisor, STRATEGY_TYPES } from '../src/StrategyAdvisor.js';
import { SentimentAnalyzer } from '../src/SentimentAnalyzer.js';
import { NewsAnalyzer } from '../src/NewsAnalyzer.js';
import { PromptBuilder } from '../src/PromptBuilder.js';
import { AIEventPublisher } from '../src/AIEvents.js';

function fakeAIManager(content) {
  return { complete: async () => ({ content, toolCalls: [], provider: 'x', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 5, cached: false }) };
}

const promptBuilder = new PromptBuilder();

test('MarketAnalyzer.analyze returns a formatted result and fires analysisCompleted', async () => {
  const eventPublisher = new AIEventPublisher();
  const events = [];
  eventPublisher.on('analysisCompleted', (e) => events.push(e));
  const analyzer = new MarketAnalyzer({ aiManager: fakeAIManager('BTC is trending up.'), promptBuilder, eventPublisher });
  const result = await analyzer.analyze('BTCUSDT', { trend: 'up', momentum: 'strong' }, 'u1');
  assert.ok(result.summary.includes('trending'));
  assert.ok(events.some((e) => e.type === 'market'));
});

test('MarketAnalyzer confidence increases with richer context', async () => {
  const eventPublisher = new AIEventPublisher();
  const analyzer = new MarketAnalyzer({ aiManager: fakeAIManager('x'), promptBuilder, eventPublisher });
  const sparse = await analyzer.analyze('BTCUSDT', {}, 'u1');
  const rich = await analyzer.analyze('BTCUSDT', { trend: 'up', momentum: 'strong', volatility: 0.02, liquidity: 'high' }, 'u1');
  assert.ok(rich.confidence > sparse.confidence);
});

test('PortfolioAdvisor.advise returns advice and fires analysisCompleted', async () => {
  const eventPublisher = new AIEventPublisher();
  const events = [];
  eventPublisher.on('analysisCompleted', (e) => events.push(e));
  const advisor = new PortfolioAdvisor({ aiManager: fakeAIManager('Well diversified.'), promptBuilder, eventPublisher });
  const result = await advisor.advise({ equity: 10000 }, 'u1');
  assert.ok(result.summary.includes('diversified'));
  assert.ok(events.some((e) => e.type === 'portfolio'));
});

test('RiskAdvisor derives deterministic warnings from data, independent of the AI text', async () => {
  const eventPublisher = new AIEventPublisher();
  const advisor = new RiskAdvisor({ aiManager: fakeAIManager('Risk looks fine.'), promptBuilder, eventPublisher });
  const risky = await advisor.explain({ leverage: 25, marginRatio: 0.85 }, 'u1');
  assert.equal(risky.warnings.length, 2);
  const safe = await advisor.explain({ leverage: 3, marginRatio: 0.1 }, 'u1');
  assert.equal(safe.warnings.length, 0);
});

test('TradeAdvisor confidence is higher with a defined stop loss and take profit', async () => {
  const eventPublisher = new AIEventPublisher();
  const advisor = new TradeAdvisor({ aiManager: fakeAIManager('Favorable setup.'), promptBuilder, eventPublisher });
  const withPlan = await advisor.analyze({ symbol: 'BTCUSDT', stopLoss: 64000, takeProfit: 68000 }, 'u1');
  const withoutPlan = await advisor.analyze({ symbol: 'BTCUSDT' }, 'u1');
  assert.ok(withPlan.confidence > withoutPlan.confidence);
});

test('STRATEGY_TYPES includes all 7 documented strategy families', () => {
  for (const s of ['scalping', 'swing', 'trendFollowing', 'meanReversion', 'breakout', 'grid', 'aiStrategy']) {
    assert.ok(STRATEGY_TYPES.includes(s));
  }
});

test('StrategyAdvisor.suggest returns a suggestion and fires strategyGenerated', async () => {
  const eventPublisher = new AIEventPublisher();
  const events = [];
  eventPublisher.on('strategyGenerated', (e) => events.push(e));
  const advisor = new StrategyAdvisor({ aiManager: fakeAIManager('A tight scalping strategy.'), promptBuilder, eventPublisher });
  const result = await advisor.suggest('a BTC scalping bot', { volatility: 0.02 }, 'u1');
  assert.ok(result.summary.includes('scalping'));
  assert.equal(events.length, 1);
  assert.equal(events[0].requestDescription, 'a BTC scalping bot');
});

test('SentimentAnalyzer parses a JSON array response into per-item results, in order', async () => {
  const content = '```json\n[{"sentiment":"bullish","score":0.7,"rationale":"r1"},{"sentiment":"bearish","score":-0.5,"rationale":"r2"}]\n```';
  const eventPublisher = new AIEventPublisher();
  const analyzer = new SentimentAnalyzer({ aiManager: fakeAIManager(content), eventPublisher });
  const results = await analyzer.analyzeBatch([{ id: 'n1', text: 'x' }, { id: 'n2', text: 'y' }], 'u1');
  assert.equal(results[0].sentiment, 'bullish');
  assert.equal(results[1].sentiment, 'bearish');
});

test('SentimentAnalyzer.aggregateScore averages correctly', () => {
  const score = SentimentAnalyzer.aggregateScore([{ score: 0.5 }, { score: -0.3 }]);
  assert.ok(Math.abs(score - 0.1) < 1e-9);
});

test('SentimentAnalyzer skips the AI call entirely for an empty batch', async () => {
  const eventPublisher = new AIEventPublisher();
  let called = false;
  const analyzer = new SentimentAnalyzer({ aiManager: { complete: async () => { called = true; } }, eventPublisher });
  const results = await analyzer.analyzeBatch([], 'u1');
  assert.equal(results.length, 0);
  assert.equal(called, false);
});

test('SentimentAnalyzer degrades to neutral/0 on malformed AI output rather than throwing', async () => {
  const eventPublisher = new AIEventPublisher();
  const analyzer = new SentimentAnalyzer({ aiManager: fakeAIManager('not valid json'), eventPublisher });
  const results = await analyzer.analyzeBatch([{ id: 'n1', text: 'x' }], 'u1');
  assert.equal(results[0].sentiment, 'neutral');
  assert.equal(results[0].score, 0);
});

test('NewsAnalyzer.analyzeItems works with directly-supplied items (no source needed)', async () => {
  const eventPublisher = new AIEventPublisher();
  const analyzer = new NewsAnalyzer({ aiManager: fakeAIManager('Cautiously positive.'), promptBuilder, eventPublisher });
  const result = await analyzer.analyzeItems([{ id: 'n1', category: 'news', headline: 'Fed holds rates', timestamp: Date.now() }], 'u1');
  assert.ok(result.summary.includes('positive'));
});

test('NewsAnalyzer has no live source integrations by default and reports that honestly', async () => {
  const eventPublisher = new AIEventPublisher();
  const analyzer = new NewsAnalyzer({ aiManager: fakeAIManager('x'), promptBuilder, eventPublisher });
  assert.equal(analyzer.hasSource('news'), false);
  await assert.rejects(() => analyzer.analyzeFromSource('news', {}, 'u1'), /no live integration/);
});

test('NewsAnalyzer.registerSource enables analyzeFromSource once a fetch function is supplied', async () => {
  const eventPublisher = new AIEventPublisher();
  const analyzer = new NewsAnalyzer({ aiManager: fakeAIManager('x'), promptBuilder, eventPublisher });
  let fetchCalled = false;
  analyzer.registerSource('macro', async () => { fetchCalled = true; return [{ id: 'm1', category: 'macro', headline: 'CPI released', timestamp: Date.now() }]; });
  await analyzer.analyzeFromSource('macro', {}, 'u1');
  assert.equal(fetchCalled, true);
});
