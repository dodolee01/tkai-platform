import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CostManager } from '../src/CostManager.js';
import { createConfig } from '../src/Config.js';

test('recordCost accumulates totals, per-user, and per-provider correctly', () => {
  const cm = new CostManager(createConfig().cost);
  cm.recordCost({ userId: 'u1', provider: 'claude', costUsd: 10 });
  cm.recordCost({ userId: 'u1', provider: 'openai', costUsd: 5 });
  cm.recordCost({ userId: 'u2', provider: 'claude', costUsd: 2 });
  assert.equal(cm.getTotalCostUsd(), 17);
  assert.equal(cm.getUserCostUsd('u1'), 15);
  assert.equal(cm.getProviderCostUsd('claude'), 12);
});

test('getCurrentMonthCostUsd isolates the current calendar month', () => {
  let now = Date.parse('2026-03-15T00:00:00Z');
  const cm = new CostManager(createConfig().cost, () => now);
  cm.recordCost({ provider: 'claude', costUsd: 10 });
  assert.equal(cm.getCurrentMonthCostUsd(), 10);
  now = Date.parse('2026-04-01T00:00:00Z');
  assert.equal(cm.getCurrentMonthCostUsd(), 0);
  assert.equal(cm.getTotalCostUsd(), 10); // total persists across months
});

test('checkBudget reports withinBudget, remaining, and utilization correctly', () => {
  const cm = new CostManager(createConfig({ cost: { monthlyBudgetUsd: 100 } }).cost);
  cm.recordCost({ provider: 'claude', costUsd: 25 });
  const budget = cm.checkBudget();
  assert.equal(budget.withinBudget, true);
  assert.equal(budget.remainingUsd, 75);
  assert.equal(budget.utilizationPct, 25);
});

test('checkBudget flags over-budget spend', () => {
  const cm = new CostManager(createConfig({ cost: { monthlyBudgetUsd: 100 } }).cost);
  cm.recordCost({ provider: 'claude', costUsd: 150 });
  assert.equal(cm.checkBudget().withinBudget, false);
  assert.equal(cm.checkBudget().remainingUsd, 0);
});

test('unknown user/provider return 0, not undefined', () => {
  const cm = new CostManager(createConfig().cost);
  assert.equal(cm.getUserCostUsd('nobody'), 0);
  assert.equal(cm.getProviderCostUsd('nobody'), 0);
});
