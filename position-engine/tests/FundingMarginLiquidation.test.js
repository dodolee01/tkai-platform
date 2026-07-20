import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFundingPayment, FundingCalculator } from '../src/FundingCalculator.js';
import { computeInitialMargin, computeMaintenanceMargin, computeMarginRatio, isMarginCallLevel } from '../src/MarginCalculator.js';
import { estimateLiquidationPrice, distanceToLiquidationPct, isLiquidated } from '../src/LiquidationCalculator.js';

test('LONG pays funding on a positive rate, SHORT receives', () => {
  assert.equal(computeFundingPayment('LONG', 10000, 0.0001), -1);
  assert.equal(computeFundingPayment('SHORT', 10000, 0.0001), 1);
});

test('FundingCalculator accumulates across multiple events', () => {
  const fc = new FundingCalculator();
  fc.recordFundingEvent('LONG', 10000, 0.0001);
  fc.recordFundingEvent('LONG', 10000, 0.0001);
  assert.equal(fc.getCumulativeFunding(), -2);
  assert.equal(fc.getHistory().length, 2);
});

test('initialMargin divides notional by leverage and rejects non-positive leverage', () => {
  assert.equal(computeInitialMargin(10000, 4), 2500);
  assert.throws(() => computeInitialMargin(10000, 0));
});

test('maintenanceMargin uses the flat default rate when no bracket table is supplied', () => {
  assert.equal(computeMaintenanceMargin(10000, 0.005), 50);
});

test('maintenanceMargin uses the matching bracket tier when supplied', () => {
  const brackets = [
    { notionalFloor: 0, notionalCap: 10000, maintenanceMarginRate: 0.004, maintenanceAmount: 0 },
    { notionalFloor: 10000, notionalCap: 100000, maintenanceMarginRate: 0.005, maintenanceAmount: 10 },
  ];
  assert.equal(computeMaintenanceMargin(50000, 0.004, brackets), 50000 * 0.005 - 10);
});

test('marginRatio and isMarginCallLevel work together', () => {
  const ratio = computeMarginRatio(80, 100);
  assert.equal(ratio, 0.8);
  assert.equal(isMarginCallLevel(ratio, 0.8), true);
  assert.equal(isMarginCallLevel(0.5, 0.8), false);
});

test('liquidation price is below entry for LONG, above for SHORT', () => {
  const long = estimateLiquidationPrice('LONG', 100, 10, 0.005);
  const short = estimateLiquidationPrice('SHORT', 100, 10, 0.005);
  assert.ok(long < 100);
  assert.ok(short > 100);
});

test('liquidation price formula matches the documented approximation exactly', () => {
  const long = estimateLiquidationPrice('LONG', 100, 5, 0.004);
  assert.ok(Math.abs(long - 100 * (1 - 0.2 + 0.004)) < 1e-9);
});

test('distanceToLiquidationPct and isLiquidated agree at the boundary', () => {
  const liq = estimateLiquidationPrice('LONG', 100, 10, 0.005);
  assert.equal(distanceToLiquidationPct('LONG', liq, liq), 0);
  assert.equal(isLiquidated('LONG', liq, liq), true);
  assert.equal(isLiquidated('LONG', liq + 1, liq), false);
});
