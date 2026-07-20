import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as PM from '../src/PerformanceMetrics.js';

const trades = [{ pnlPercent: 0.02 }, { pnlPercent: -0.01 }, { pnlPercent: 0.03 }, { pnlPercent: -0.015 }, { pnlPercent: 0.01 }];

test('winRate and lossRate sum to 1 with no breakeven trades', () => {
  assert.ok(Math.abs(PM.winRate(trades) + PM.lossRate(trades) - 1) < 1e-9);
});

test('winRate is 0 for an empty trade list', () => {
  assert.equal(PM.winRate([]), 0);
});

test('averageProfit and averageLoss only consider their respective sign', () => {
  assert.ok(Math.abs(PM.averageProfit(trades) - (0.02 + 0.03 + 0.01) / 3) < 1e-9);
  assert.ok(Math.abs(PM.averageLoss(trades) - (0.01 + 0.015) / 2) < 1e-9);
});

test('expectancy matches the textbook formula', () => {
  const expected = PM.winRate(trades) * PM.averageProfit(trades) - PM.lossRate(trades) * PM.averageLoss(trades);
  assert.ok(Math.abs(PM.expectancy(trades) - expected) < 1e-9);
});

test('profitFactor handles the zero-loss and zero-win edge cases', () => {
  assert.equal(PM.profitFactor([{ pnlPercent: 0.05 }]), Infinity);
  assert.equal(PM.profitFactor([{ pnlPercent: -0.05 }]), 0);
});

test('buildEquityCurve compounds returns starting at 1.0', () => {
  const curve = PM.buildEquityCurve([{ pnlPercent: 0.1 }, { pnlPercent: -0.1 }]);
  assert.equal(curve[0], 1);
  assert.ok(Math.abs(curve[1] - 1.1) < 1e-9);
  assert.ok(Math.abs(curve[2] - 1.1 * 0.9) < 1e-9);
});

test('maxDrawdown finds the true peak-to-trough decline, not just the last drop', () => {
  const dd = PM.maxDrawdown([1, 1.2, 1.1, 1.5, 1.0]); // peak 1.5, trough 1.0 -> 33.3%
  assert.ok(Math.abs(dd - (1.5 - 1.0) / 1.5) < 1e-9);
});

test('sharpeRatio and sortinoRatio are 0 with fewer than 2 trades', () => {
  assert.equal(PM.sharpeRatio([{ pnlPercent: 0.01 }]), 0);
  assert.equal(PM.sortinoRatio([{ pnlPercent: 0.01 }]), 0);
});

test('sortinoRatio ignores upside volatility (only penalizes downside)', () => {
  const volatileButAllPositive = [{ pnlPercent: 0.01 }, { pnlPercent: 0.5 }, { pnlPercent: 0.02 }];
  const sortino = PM.sortinoRatio(volatileButAllPositive, 0, 1);
  assert.equal(sortino, Infinity); // no downside deviation at all
});

test('calmarRatio is proportional to total return over max drawdown', () => {
  const curve = [1, 1.2, 1.0, 1.5];
  const calmar = PM.calmarRatio(curve);
  const expectedReturn = 1.5 / 1 - 1;
  const dd = PM.maxDrawdown(curve);
  assert.ok(Math.abs(calmar - expectedReturn / dd) < 1e-9);
});

test('computePerformanceStats returns every documented field as a number', () => {
  const stats = PM.computePerformanceStats(trades);
  for (const key of ['winRate', 'lossRate', 'averageProfit', 'averageLoss', 'expectancy', 'profitFactor', 'sharpeRatio', 'sortinoRatio', 'calmarRatio', 'maxDrawdown', 'recoveryFactor']) {
    assert.equal(typeof stats[key], 'number', `${key} should be a number`);
  }
});
