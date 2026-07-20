import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawdownManager } from '../src/DrawdownManager.js';
import { createConfig } from '../src/Config.js';

test('drawdown is 0 with no observations', () => {
  const dm = new DrawdownManager(createConfig().drawdown);
  assert.equal(dm.getCurrentDrawdownPct(), 0);
});

test('peak equity only rises, never falls', () => {
  const dm = new DrawdownManager(createConfig().drawdown);
  dm.recordEquity(1000);
  dm.recordEquity(1500);
  dm.recordEquity(1200);
  assert.equal(dm.peakEquity, 1500);
});

test('drawdown pct is computed relative to peak, not previous value', () => {
  const dm = new DrawdownManager(createConfig().drawdown);
  dm.recordEquity(1000);
  dm.recordEquity(2000);
  dm.recordEquity(1800);
  assert.ok(Math.abs(dm.getCurrentDrawdownPct() - 0.1) < 1e-9);
});

test('isDrawdownExceeded and isEquityProtectionTriggered fire at their respective thresholds', () => {
  const dm = new DrawdownManager(createConfig({ drawdown: { maxDrawdownPct: 0.1, equityProtectionThresholdPct: 0.2 } }).drawdown);
  dm.recordEquity(1000);
  dm.recordEquity(850); // 15% drawdown
  assert.equal(dm.isDrawdownExceeded(), true);
  assert.equal(dm.isEquityProtectionTriggered(), false);
  dm.recordEquity(750); // 25% drawdown from peak 1000
  assert.equal(dm.isEquityProtectionTriggered(), true);
});

test('reset clears all state', () => {
  const dm = new DrawdownManager(createConfig().drawdown);
  dm.recordEquity(1000);
  dm.reset();
  assert.equal(dm.peakEquity, null);
  assert.equal(dm.getCurrentDrawdownPct(), 0);
});
