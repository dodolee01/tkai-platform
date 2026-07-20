import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeUnrealizedPnl, computeRealizedPnl, computeNetPnl } from '../src/PnLCalculator.js';
import { computeRoi, computeUnleveragedRoi } from '../src/ROIEngine.js';

test('unrealizedPnl is symmetric between LONG profit and SHORT profit', () => {
  assert.equal(computeUnrealizedPnl('LONG', 100, 110, 1), 10);
  assert.equal(computeUnrealizedPnl('SHORT', 100, 90, 1), 10);
});

test('unrealizedPnl is negative when price moves against the position', () => {
  assert.equal(computeUnrealizedPnl('LONG', 100, 90, 1), -10);
  assert.equal(computeUnrealizedPnl('SHORT', 100, 110, 1), -10);
});

test('realizedPnl scales with the closed quantity, not the full position', () => {
  assert.equal(computeRealizedPnl('LONG', 100, 110, 0.5), 5);
});

test('netPnl subtracts both trading and funding fees', () => {
  assert.equal(computeNetPnl(100, 10, 5), 85);
});

test('computeRoi divides by initial margin, not notional', () => {
  assert.equal(computeRoi(100, 500), 20);
  assert.equal(computeRoi(100, 0), 0);
});

test('computeUnleveragedRoi divides by full notional', () => {
  assert.equal(computeUnleveragedRoi(100, 5000), 2);
});
