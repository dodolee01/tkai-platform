import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTakeProfitTargets, computeBlendedRiskReward, meetsMinimumRiskReward } from '../src/TakeProfit.js';
import { createConfig } from '../src/Config.js';

test('computeTakeProfitTargets places targets at correct R-multiples for LONG', () => {
  const config = createConfig().takeProfit;
  const targets = computeTakeProfitTargets({ side: 'LONG', entryPrice: 100, stopLoss: 90, volatility: 0.01 }, config);
  assert.equal(targets[0].price, 110); // 1R = 10, entry+10
  assert.equal(targets[1].price, 120); // 2R
  assert.equal(targets[2].price, 135); // 3.5R
});

test('computeTakeProfitTargets places targets below entry for SHORT', () => {
  const config = createConfig().takeProfit;
  const targets = computeTakeProfitTargets({ side: 'SHORT', entryPrice: 100, stopLoss: 110, volatility: 0.01 }, config);
  assert.equal(targets[0].price, 90);
});

test('computeTakeProfitTargets returns empty array for zero/negative risk', () => {
  const config = createConfig().takeProfit;
  const targets = computeTakeProfitTargets({ side: 'LONG', entryPrice: 100, stopLoss: 100, volatility: 0.01 }, config);
  assert.deepEqual(targets, []);
});

test('high volatility expands target distance', () => {
  const config = createConfig().takeProfit;
  const normal = computeTakeProfitTargets({ side: 'LONG', entryPrice: 100, stopLoss: 90, volatility: 0.01 }, config);
  const expanded = computeTakeProfitTargets({ side: 'LONG', entryPrice: 100, stopLoss: 90, volatility: 0.05 }, config);
  assert.ok(expanded[0].price > normal[0].price);
});

test('computeBlendedRiskReward is the size-weighted average R multiple', () => {
  const targets = [
    { price: 0, sizePct: 0.5, rMultiple: 1 },
    { price: 0, sizePct: 0.5, rMultiple: 3 },
  ];
  assert.equal(computeBlendedRiskReward(targets), 2);
});

test('meetsMinimumRiskReward compares against config threshold', () => {
  const config = createConfig({ takeProfit: { minRiskReward: 2 } }).takeProfit;
  assert.equal(meetsMinimumRiskReward(2.5, config), true);
  assert.equal(meetsMinimumRiskReward(1.5, config), false);
});
