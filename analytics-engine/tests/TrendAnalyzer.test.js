import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTrend, computeSMA, detectCrossover } from '../src/TrendAnalyzer.js';

test('analyzeTrend correctly classifies up/down/flat series', () => {
  assert.equal(analyzeTrend([100, 102, 104, 106, 108, 110]).direction, 'up');
  assert.equal(analyzeTrend([110, 108, 105, 100, 95]).direction, 'down');
  assert.equal(analyzeTrend([100, 100.01, 99.99, 100, 100.02]).direction, 'flat');
});

test('analyzeTrend strength approaches 1 for a perfectly linear series', () => {
  assert.ok(analyzeTrend([1, 2, 3, 4, 5, 6]).strength > 0.99);
});

test('computeSMA returns null before the window fills, then correct averages', () => {
  const sma = computeSMA([1, 2, 3, 4, 5], 3);
  assert.equal(sma[0], null);
  assert.equal(sma[1], null);
  assert.equal(sma[2], 2);
  assert.equal(sma[4], 4);
});

test('detectCrossover finds a golden cross even when it happened several steps in the past', () => {
  const data = [10, 10, 10, 10, 10, 15, 20, 25, 30, 35];
  assert.equal(detectCrossover(data, 2, 5), 'golden_cross');
});

test('detectCrossover finds the MOST RECENT crossover when both types occur', () => {
  const data = [10, 10, 10, 10, 10, 15, 20, 25, 30, 35, 35, 35, 35, 35, 30, 25, 20, 15, 10];
  assert.equal(detectCrossover(data, 2, 5), 'death_cross');
});

test('detectCrossover returns none when fast/slow never swap relative position', () => {
  assert.equal(detectCrossover([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2, 3), 'none');
});
