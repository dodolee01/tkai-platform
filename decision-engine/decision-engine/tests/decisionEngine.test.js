import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionEngine } from '../src/DecisionEngine.js';

function strongBullishSnapshot(overrides = {}) {
  return {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    ema20: 98,
    ema50: 95,
    ema200: 90,
    rsi: 65,
    macd: { macd: 12, signal: 9, histogram: 3 },
    atr: 1.5,
    adx: 35,
    supertrend: { value: 97, direction: 'up' },
    bollinger: { upper: 102, middle: 100, lower: 98 },
    ichimoku: { tenkan: 98, kijun: 96, senkouA: 95, senkouB: 93 },
    stochastic: { k: 70, d: 60 },
    mfi: 65,
    vwap: 97,
    obv: 150000,
    cmf: 0.09,
    cci: 120,
    williamsR: -25,
    funding: -0.0003,
    openInterest: { value: 1_000_000, change24h: 50_000 },
    liquidation: { longLiquidations: 10_000, shortLiquidations: 12_000 },
    orderBook: { imbalance: 0.3 },
    delta: 5000,
    volumeProfile: { poc: 99.5, valueAreaHigh: 101, valueAreaLow: 99 },
    pivot: { pivot: 97, r1: 99, s1: 95 },
    ...overrides
  };
}

function strongBearishSnapshot(overrides = {}) {
  return {
    symbol: 'ETHUSDT',
    timeframe: '15m',
    price: 100,
    ema20: 102,
    ema50: 105,
    ema200: 110,
    rsi: 35,
    macd: { macd: -12, signal: -9, histogram: -3 },
    atr: 1.5,
    adx: 35,
    supertrend: { value: 103, direction: 'down' },
    bollinger: { upper: 102, middle: 100, lower: 98 },
    ichimoku: { tenkan: 102, kijun: 104, senkouA: 105, senkouB: 107 },
    stochastic: { k: 30, d: 40 },
    mfi: 35,
    vwap: 103,
    obv: 150000,
    cmf: -0.09,
    cci: -120,
    williamsR: -75,
    funding: 0.0003,
    openInterest: { value: 1_000_000, change24h: 50_000 },
    liquidation: { longLiquidations: 12_000, shortLiquidations: 10_000 },
    orderBook: { imbalance: -0.3 },
    delta: -5000,
    volumeProfile: { poc: 100.5, valueAreaHigh: 101, valueAreaLow: 99 },
    pivot: { pivot: 103, r1: 105, s1: 101 },
    ...overrides
  };
}

test('DecisionEngine: strongly bullish confluence yields LONG with high confidence', () => {
  const engine = new DecisionEngine();
  const result = engine.evaluate(strongBullishSnapshot());

  assert.equal(result.decision, 'LONG');
  assert.ok(result.confidence >= 55, `expected confidence >= 55, got ${result.confidence}`);
  assert.ok(result.bullishSignals.length > 0);
  assert.equal(typeof result.scoreBreakdown.total, 'number');
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(result.riskLevel));
  assert.ok(result.recommendedLeverage >= 1);
});

test('DecisionEngine: strongly bearish confluence yields SHORT with high confidence', () => {
  const engine = new DecisionEngine();
  const result = engine.evaluate(strongBearishSnapshot());

  assert.equal(result.decision, 'SHORT');
  assert.ok(result.confidence >= 55, `expected confidence >= 55, got ${result.confidence}`);
  assert.ok(result.bearishSignals.length > 0);
});

test('DecisionEngine: mixed/conflicting snapshot yields WAIT', () => {
  const engine = new DecisionEngine();
  const result = engine.evaluate({
    symbol: 'SOLUSDT',
    timeframe: '5m',
    price: 100,
    ema20: 100.2,
    ema50: 99.8,
    ema200: 100.1,
    rsi: 50,
    adx: 12,
    macd: { macd: 0.1, signal: 0.1, histogram: 0 },
    atr: 0.3,
    bollinger: { upper: 101, middle: 100, lower: 99 }
  });

  assert.equal(result.decision, 'WAIT');
});

test('DecisionEngine: abnormal funding rate triggers NEWS_RISK state', () => {
  const engine = new DecisionEngine();
  const result = engine.evaluate(strongBullishSnapshot({ funding: 0.02 }));
  assert.equal(result.marketState, 'NEWS_RISK');
});

test('DecisionEngine: a held LONG call is exited when the market reverses hard', () => {
  const engine = new DecisionEngine();

  const first = engine.evaluate(strongBullishSnapshot({ symbol: 'XRPUSDT' }));
  assert.equal(first.decision, 'LONG');

  const second = engine.evaluate(strongBearishSnapshot({ symbol: 'XRPUSDT' }));
  assert.equal(second.decision, 'EXIT');
});

test('DecisionEngine: rejects an invalid snapshot', () => {
  const engine = new DecisionEngine();
  assert.throws(() => engine.evaluate({ symbol: 'BTCUSDT' }), TypeError);
  assert.throws(() => engine.evaluate({ symbol: 'BTCUSDT', timeframe: '15m', price: -5 }), TypeError);
  assert.throws(() => engine.evaluate(null), TypeError);
});

test('DecisionEngine: resetHistory clears prior state for a symbol/timeframe', () => {
  const engine = new DecisionEngine();
  engine.evaluate(strongBullishSnapshot({ symbol: 'ADAUSDT' }));
  engine.resetHistory('ADAUSDT', '15m');
  // After reset there is no history entry, so a bearish snapshot should NOT
  // be forced into EXIT purely due to a remembered prior LONG call.
  const result = engine.evaluate(strongBearishSnapshot({ symbol: 'ADAUSDT' }));
  assert.equal(result.decision, 'SHORT');
});

test('DecisionEngine: configuration overrides are respected', () => {
  const strictEngine = new DecisionEngine({ decision: { minConfidence: 99 } });
  const result = strictEngine.evaluate(strongBullishSnapshot());
  // With an unreachable confidence floor, even a strong confluence must wait.
  assert.equal(result.decision, 'WAIT');
});
