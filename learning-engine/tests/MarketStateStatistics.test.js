import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMarketStatePerformance, findUnobservedRegimes } from '../src/MarketStateStatistics.js';
import { MARKET_REGIMES } from '../src/Config.js';

const perfConfig = { riskFreeRatePerTrade: 0, annualizationFactor: 1 };

test('computeMarketStatePerformance groups independently per regime', () => {
  const trades = [
    { marketState: 'TRENDING', pnlPercent: 0.02 },
    { marketState: 'TRENDING', pnlPercent: 0.01 },
    { marketState: 'RANGING', pnlPercent: -0.02 },
  ];
  const result = computeMarketStatePerformance(trades, perfConfig);
  assert.equal(result.length, 2);
  const trending = result.find((r) => r.marketState === 'TRENDING');
  assert.equal(trending.trades, 2);
  assert.equal(trending.stats.winRate, 1);
});

test('computeMarketStatePerformance buckets a missing marketState as "unknown"', () => {
  const result = computeMarketStatePerformance([{ pnlPercent: 0.01 }], perfConfig);
  assert.equal(result[0].marketState, 'unknown');
});

test('findUnobservedRegimes returns configured regimes with no trades yet', () => {
  const observed = [{ marketState: 'TRENDING', trades: 5, stats: {} }];
  const unobserved = findUnobservedRegimes(observed, MARKET_REGIMES);
  assert.ok(unobserved.includes('RANGING'));
  assert.ok(!unobserved.includes('TRENDING'));
  assert.equal(unobserved.length, MARKET_REGIMES.length - 1);
});
