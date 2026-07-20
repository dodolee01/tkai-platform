import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEquity, EquityCalculator } from '../src/EquityCalculator.js';

test('computeEquity adds wallet balance and unrealized PnL', () => {
  assert.equal(computeEquity(10000, -200), 9800);
});

test('currentEquity is the most recently recorded value', () => {
  const ec = new EquityCalculator();
  ec.recordEquity(1000);
  ec.recordEquity(1200);
  assert.equal(ec.getCurrentEquity(), 1200);
});

test('dailyEquity is the first observation of the current UTC day', () => {
  const ec = new EquityCalculator();
  const day1 = Date.parse('2026-04-01T00:00:00Z');
  ec.recordEquity(1000, day1);
  ec.recordEquity(1100, day1 + 3600000);
  assert.equal(ec.getDailyEquity(), 1000);
});

test('dailyEquity resets at a new UTC day boundary', () => {
  const ec = new EquityCalculator();
  const day1 = Date.parse('2026-04-01T00:00:00Z');
  const day2 = Date.parse('2026-04-02T00:00:00Z');
  ec.recordEquity(1000, day1);
  ec.recordEquity(1050, day2);
  assert.equal(ec.getDailyEquity(), 1050);
});

test('peakEquity and lowestEquity track all-time extremes', () => {
  const ec = new EquityCalculator();
  ec.recordEquity(1000);
  ec.recordEquity(1500);
  ec.recordEquity(800);
  ec.recordEquity(1200);
  assert.equal(ec.getPeakEquity(), 1500);
  assert.equal(ec.getLowestEquity(), 800);
});

test('getReport returns every documented field', () => {
  const ec = new EquityCalculator();
  ec.recordEquity(1000);
  const report = ec.getReport();
  for (const key of ['currentEquity', 'dailyEquity', 'weeklyEquity', 'monthlyEquity', 'peakEquity', 'lowestEquity']) {
    assert.ok(key in report);
  }
});

test('an empty calculator returns all zeros without throwing', () => {
  const ec = new EquityCalculator();
  const report = ec.getReport();
  assert.deepEqual(report, { currentEquity: 0, dailyEquity: 0, weeklyEquity: 0, monthlyEquity: 0, peakEquity: 0, lowestEquity: 0 });
});

test('reset clears history and extremes', () => {
  const ec = new EquityCalculator();
  ec.recordEquity(1000);
  ec.reset();
  assert.equal(ec.getCurrentEquity(), 0);
  assert.equal(ec.getPeakEquity(), 0);
});

test('getHistory returns a defensive copy', () => {
  const ec = new EquityCalculator();
  ec.recordEquity(1000);
  const history = ec.getHistory();
  history.push({ equity: 9999, timestamp: 0 });
  assert.equal(ec.getHistory().length, 1);
});
