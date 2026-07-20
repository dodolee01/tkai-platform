import test from 'node:test';
import assert from 'node:assert/strict';
import { Filters } from '../src/Filters.js';
import { createConfig } from '../src/Config.js';

const config = createConfig();

function baseScoreResult(overrides = {}) {
  return {
    totalScore: 0,
    dominantDirection: 'NEUTRAL',
    confidence: 80,
    participation: { bullishWeight: 0, bearishWeight: 0, neutralWeight: 0, totalWeight: 0 },
    ...overrides
  };
}

test('Filters: forces WAIT on RANGING market state', () => {
  const filters = new Filters(config);
  const result = filters.apply({
    marketStateResult: { state: 'RANGING', reasons: [] },
    scoreResult: baseScoreResult(),
    trendResult: { pullback: false, trendPresent: false, direction: 'NEUTRAL' },
    momentumResult: { exhaustionRisk: false },
    volatilityResult: { level: 'LOW' },
    signalResult: { orderflowSignals: [] },
    snapshot: { symbol: 'BTCUSDT', timeframe: '15m', price: 100 },
    previousSnapshot: null,
    historyEntry: null
  });

  assert.equal(result.forcedDecision, 'WAIT');
});

test('Filters: flags conflicting_indicators when bullish/bearish weight is balanced', () => {
  const filters = new Filters(config);
  const result = filters.apply({
    marketStateResult: { state: 'TRENDING', reasons: [] },
    scoreResult: baseScoreResult({
      totalScore: 5,
      dominantDirection: 'BULLISH',
      participation: { bullishWeight: 50, bearishWeight: 49, neutralWeight: 0, totalWeight: 99 }
    }),
    trendResult: { pullback: false, trendPresent: true, direction: 'BULLISH' },
    momentumResult: { exhaustionRisk: false },
    volatilityResult: { level: 'MEDIUM' },
    signalResult: { orderflowSignals: [] },
    snapshot: { symbol: 'BTCUSDT', timeframe: '15m', price: 100 },
    previousSnapshot: null,
    historyEntry: null
  });

  assert.ok(result.rejections.some((r) => r.startsWith('conflicting_indicators')));
  assert.ok(result.confidenceAdjustment < 0);
});

test('Filters: rejects unconfirmed breakout and downgrades market state to RANGING', () => {
  const filters = new Filters(config);
  const marketStateResult = { state: 'BREAKOUT', reasons: [] };
  const result = filters.apply({
    marketStateResult,
    scoreResult: baseScoreResult({ totalScore: 40, dominantDirection: 'BULLISH' }),
    trendResult: { pullback: false, trendPresent: true, direction: 'BULLISH' },
    momentumResult: { exhaustionRisk: false },
    volatilityResult: { level: 'HIGH' },
    signalResult: {
      orderflowSignals: [
        { category: 'orderflow', indicator: 'openInterest', signal: 'NEUTRAL' },
        { category: 'orderflow', indicator: 'delta', signal: 'NEUTRAL' },
        { category: 'orderflow', indicator: 'orderBook', signal: 'NEUTRAL' }
      ]
    },
    snapshot: { symbol: 'BTCUSDT', timeframe: '15m', price: 100 },
    previousSnapshot: null,
    historyEntry: null
  });

  assert.ok(result.rejections.some((r) => r.startsWith('fake_breakout_suspected')));
  assert.equal(marketStateResult.state, 'RANGING');
});

test('Filters: low confidence forces WAIT', () => {
  const filters = new Filters(config);
  const result = filters.apply({
    marketStateResult: { state: 'TRENDING', reasons: [] },
    scoreResult: baseScoreResult({ totalScore: 20, dominantDirection: 'BULLISH', confidence: 30 }),
    trendResult: { pullback: false, trendPresent: true, direction: 'BULLISH' },
    momentumResult: { exhaustionRisk: false },
    volatilityResult: { level: 'MEDIUM' },
    signalResult: { orderflowSignals: [] },
    snapshot: { symbol: 'BTCUSDT', timeframe: '15m', price: 100 },
    previousSnapshot: null,
    historyEntry: null
  });

  assert.equal(result.forcedDecision, 'WAIT');
  assert.ok(result.rejections.some((r) => r.startsWith('low_confidence')));
});

test('Filters: exhaustion against a held LONG position forces EXIT', () => {
  const filters = new Filters(config);
  const result = filters.apply({
    marketStateResult: { state: 'TRENDING', reasons: [] },
    scoreResult: baseScoreResult({ totalScore: -10, dominantDirection: 'BEARISH', confidence: 80 }),
    trendResult: { pullback: false, trendPresent: true, direction: 'BULLISH' },
    momentumResult: { exhaustionRisk: true },
    volatilityResult: { level: 'MEDIUM' },
    signalResult: { orderflowSignals: [] },
    snapshot: { symbol: 'BTCUSDT', timeframe: '15m', price: 100 },
    previousSnapshot: null,
    historyEntry: { decision: 'LONG', state: 'TRENDING' }
  });

  assert.equal(result.forcedDecision, 'EXIT');
});
