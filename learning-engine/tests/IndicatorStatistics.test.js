import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRawIndicatorStats, buildIndicatorPerformance } from '../src/IndicatorStatistics.js';

const trades = [
  { pnlPercent: 0.02, bullishSignals: ['a', 'b'], bearishSignals: [] },
  { pnlPercent: -0.01, bullishSignals: ['a'], bearishSignals: [] },
  { pnlPercent: 0.03, bullishSignals: [], bearishSignals: ['c'] },
];

test('computeRawIndicatorStats counts appearances across both signal arrays', () => {
  const stats = computeRawIndicatorStats(trades);
  assert.equal(stats.get('a').appearances, 2);
  assert.equal(stats.get('b').appearances, 1);
  assert.equal(stats.get('c').appearances, 1);
});

test('computeRawIndicatorStats tracks wins/losses per indicator correctly', () => {
  const stats = computeRawIndicatorStats(trades);
  assert.equal(stats.get('a').wins, 1);
  assert.equal(stats.get('a').losses, 1);
  assert.equal(stats.get('b').wins, 1);
});

test('buildIndicatorPerformance computes winRate and expectancy correctly', () => {
  const raw = computeRawIndicatorStats(trades);
  const perf = buildIndicatorPerformance(raw, {});
  const a = perf.find((p) => p.indicator === 'a');
  assert.equal(a.winRate, 0.5);
  assert.ok(Math.abs(a.avgPnlPercent - (0.02 - 0.01) / 2) < 1e-9);
});

test('buildIndicatorPerformance applies supplied weights and falls back to baseline', () => {
  const raw = computeRawIndicatorStats(trades);
  const perf = buildIndicatorPerformance(raw, { a: 1.5 }, 1.0);
  assert.equal(perf.find((p) => p.indicator === 'a').weight, 1.5);
  assert.equal(perf.find((p) => p.indicator === 'b').weight, 1.0);
});

test('buildIndicatorPerformance sorts by expectancy descending', () => {
  const raw = computeRawIndicatorStats(trades);
  const perf = buildIndicatorPerformance(raw, {});
  for (let i = 1; i < perf.length; i++) {
    assert.ok(perf[i - 1].expectancy >= perf[i].expectancy);
  }
});
