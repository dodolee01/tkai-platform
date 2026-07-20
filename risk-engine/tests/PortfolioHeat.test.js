import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolioHeat, isHeatWithinLimit } from '../src/PortfolioHeat.js';

test('computePortfolioHeat sums open risk plus proposed risk, as % of equity', () => {
  const heat = computePortfolioHeat({ openPositions: [{ riskAmount: 100 }, { riskAmount: 150 }], proposedRiskAmount: 50, equity: 10000 });
  assert.ok(Math.abs(heat - 3) < 1e-9);
});

test('computePortfolioHeat returns 0 for non-positive equity', () => {
  assert.equal(computePortfolioHeat({ openPositions: [], proposedRiskAmount: 10, equity: 0 }), 0);
});

test('isHeatWithinLimit compares correctly at the boundary', () => {
  assert.equal(isHeatWithinLimit(5, 5), true);
  assert.equal(isHeatWithinLimit(5.01, 5), false);
});
