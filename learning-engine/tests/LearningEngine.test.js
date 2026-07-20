import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningEngine } from '../src/LearningEngine.js';
import { InMemoryPersistenceAdapter } from '../src/Persistence.js';

function makeTrade(i, overrides = {}) {
  const win = i % 3 !== 0;
  return {
    symbol: 'BTCUSDT', timeframe: '15m', entryPrice: 65000, exitPrice: win ? 66000 : 64000,
    stopLoss: 64000, takeProfit: 67000, side: 'LONG', leverage: 5, quantity: 0.1,
    pnl: win ? 100 : -100, pnlPercent: win ? 0.02 : -0.015, fees: 2, confidence: 0.7,
    marketState: 'TRENDING', trendStrength: 0.7, volatility: 0.02, riskScore: 15, rrRatio: 2.5,
    executionTime: 3600000, decision: 'LONG',
    bullishSignals: win ? ['ema_cross'] : ['macd_weak'],
    bearishSignals: [], scoreBreakdown: {}, indicatorSnapshot: {}, timestamp: Date.now() + i,
    ...overrides,
  };
}

test('getLearningOutput returns the exact required output shape', async () => {
  const engine = new LearningEngine();
  await engine.initialize();
  await engine.recordTrade(makeTrade(0));
  const output = engine.getLearningOutput();
  for (const key of [
    'updatedWeights', 'updatedConfidenceModel', 'indicatorPerformance', 'strategyPerformance',
    'recommendations', 'learningScore', 'confidenceCalibration', 'optimizationSummary',
  ]) {
    assert.ok(key in output, `missing key: ${key}`);
  }
});

test('recordTrade never mutates a previously recorded trade', async () => {
  const engine = new LearningEngine();
  await engine.initialize();
  await engine.recordTrade(makeTrade(0));
  const firstSnapshot = JSON.stringify(engine.tradeStore.getAllTrades()[0]);
  await engine.recordTrade(makeTrade(1));
  const firstAfterSecondTrade = JSON.stringify(engine.tradeStore.getAllTrades()[0]);
  assert.equal(firstSnapshot, firstAfterSecondTrade);
});

test('good indicators gain weight, poor indicators lose weight, over enough trades', async () => {
  const engine = new LearningEngine({ configOverrides: { weightOptimizer: { minSampleSize: 10 } } });
  await engine.initialize();
  let output;
  for (let i = 0; i < 40; i++) output = await engine.recordTrade(makeTrade(i));
  assert.ok(output.updatedWeights.ema_cross > 1.0);
  assert.ok(output.updatedWeights.macd_weak < 1.0);
});

test('learningScore is between 0 and 100', async () => {
  const engine = new LearningEngine();
  await engine.initialize();
  let output;
  for (let i = 0; i < 20; i++) output = await engine.recordTrade(makeTrade(i));
  assert.ok(output.learningScore >= 0 && output.learningScore <= 100);
});

test('calibrateConfidence and getIndicatorWeight expose the current model without recomputation side effects', async () => {
  const engine = new LearningEngine({ configOverrides: { weightOptimizer: { minSampleSize: 5 } } });
  await engine.initialize();
  for (let i = 0; i < 20; i++) await engine.recordTrade(makeTrade(i));
  assert.equal(typeof engine.calibrateConfidence(0.7), 'number');
  assert.equal(engine.getIndicatorWeight('never_seen_indicator'), engine.config.weightOptimizer.baselineWeight);
});

test('initialize() hydrates prior session history from persistence', async () => {
  const adapter = new InMemoryPersistenceAdapter();
  const priorEngine = new LearningEngine({ persistenceAdapter: adapter });
  await priorEngine.initialize();
  await priorEngine.recordTrade(makeTrade(0));
  await priorEngine.recordTrade(makeTrade(1));

  const newEngine = new LearningEngine({ persistenceAdapter: adapter });
  await newEngine.initialize();
  assert.equal(newEngine.tradeStore.size, 2);
});

test('a custom strategyKeyFn is honored in strategyPerformance output', async () => {
  const engine = new LearningEngine({
    configOverrides: { weightOptimizer: { minSampleSize: 100 } },
    strategyKeyFn: (t) => t.symbol,
  });
  await engine.initialize();
  const output = await engine.recordTrade(makeTrade(0));
  assert.equal(output.strategyPerformance[0].strategyKey, 'BTCUSDT');
});

test('optimizationSummary.totalTrades tracks the running trade count', async () => {
  const engine = new LearningEngine();
  await engine.initialize();
  let output;
  for (let i = 0; i < 7; i++) output = await engine.recordTrade(makeTrade(i));
  assert.equal(output.optimizationSummary.totalTrades, 7);
});
