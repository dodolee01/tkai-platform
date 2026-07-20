import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawdownTracker } from '../src/DrawdownTracker.js';
import { createConfig } from '../src/Config.js';

test('drawdown is zero with no history', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  assert.equal(dt.getCurrentDrawdownPct(), 0);
  assert.equal(dt.getMaxDrawdownPct(), 0);
});

test('current drawdown is measured from the all-time peak', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  dt.recordEquity(1000);
  dt.recordEquity(1500);
  dt.recordEquity(1200);
  assert.ok(Math.abs(dt.getCurrentDrawdownPct() - 20) < 1e-9);
});

test('maxDrawdownPct captures the worst peak-to-trough decline across all history', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  dt.recordEquity(1000);
  dt.recordEquity(1300); // peak
  dt.recordEquity(1000); // 23% dd
  dt.recordEquity(1400); // new peak
  dt.recordEquity(1350); // small dd
  assert.ok(dt.getMaxDrawdownPct() > 20 && dt.getMaxDrawdownPct() < 24);
});

test('daily drawdown resets at a new UTC day boundary', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  const day1 = Date.parse('2026-03-01T00:00:00Z');
  dt.recordEquity(1000, day1);
  dt.recordEquity(800, day1 + 1000); // 20% intraday drawdown
  assert.ok(dt.getDailyDrawdownPct() > 15);
  const day2 = Date.parse('2026-03-02T00:00:00Z');
  dt.recordEquity(800, day2);
  assert.equal(dt.getDailyDrawdownPct(), 0);
});

test('isMaxDrawdownExceeded fires once the configured threshold is breached', () => {
  const dt = new DrawdownTracker(createConfig({ drawdown: { maxDrawdownPct: 0.1 } }).drawdown);
  dt.recordEquity(1000);
  dt.recordEquity(850); // 15% drawdown > 10% threshold
  assert.equal(dt.isMaxDrawdownExceeded(), true);
});

test('recoveryPct is 100 with no drawdown, and between 0-100 during partial recovery', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  dt.recordEquity(1000);
  assert.equal(dt.getRecoveryPct(), 100);
  dt.recordEquity(500); // trough
  dt.recordEquity(750); // halfway back
  const recovery = dt.getRecoveryPct();
  assert.ok(recovery > 0 && recovery < 100);
});

test('getReport returns every documented field', () => {
  const dt = new DrawdownTracker(createConfig().drawdown);
  dt.recordEquity(1000);
  const report = dt.getReport();
  for (const key of ['dailyDrawdownPct', 'weeklyDrawdownPct', 'monthlyDrawdownPct', 'maxDrawdownPct', 'currentDrawdownPct', 'recoveryPct']) {
    assert.ok(key in report);
  }
});
