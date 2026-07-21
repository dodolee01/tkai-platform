import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeParameters, findBestParameters } from '../src/OptimizationEngine.js';
import { createConfig } from '../src/Config.js';

test('optimizeParameters ranks candidates by composite score, best first', () => {
  const config = createConfig();
  const candidates = [
    { parameters: { p: 14 }, trades: [{ realizedPnl: 100, closedAt: 1 }, { realizedPnl: -20, closedAt: 2 }, { realizedPnl: 80, closedAt: 3 }] },
    { parameters: { p: 21 }, trades: [{ realizedPnl: -50, closedAt: 1 }, { realizedPnl: -30, closedAt: 2 }, { realizedPnl: 10, closedAt: 3 }] },
  ];
  const results = optimizeParameters(candidates, config);
  assert.equal(results.length, 2);
  assert.equal(results[0].parameters.p, 14); // the profitable candidate wins
  assert.ok(results[0].score >= results[1].score);
});

test('findBestParameters returns the single top-ranked candidate', () => {
  const config = createConfig();
  const candidates = [
    { parameters: { p: 1 }, trades: [{ realizedPnl: -10, closedAt: 1 }] },
    { parameters: { p: 2 }, trades: [{ realizedPnl: 50, closedAt: 1 }] },
  ];
  const best = findBestParameters(candidates, config);
  assert.equal(best.parameters.p, 2);
});

test('findBestParameters returns null for an empty candidate list', () => {
  assert.equal(findBestParameters([], createConfig()), null);
});

test('a custom scoring function is honored', () => {
  const config = createConfig();
  const candidates = [
    { parameters: { p: 1 }, trades: [{ realizedPnl: 10, closedAt: 1 }] },
    { parameters: { p: 2 }, trades: [{ realizedPnl: 5, closedAt: 1 }] },
  ];
  // Custom scorer that always prefers the lowest netProfit (inverse of normal).
  const results = optimizeParameters(candidates, config, (metrics) => -metrics.netProfit);
  assert.equal(results[0].parameters.p, 2);
});

test('every result includes netProfit, profitFactor, winRate, sharpeRatio, and score', () => {
  const config = createConfig();
  const results = optimizeParameters([{ parameters: {}, trades: [{ realizedPnl: 10, closedAt: 1 }] }], config);
  for (const key of ['netProfit', 'profitFactor', 'winRate', 'sharpeRatio', 'score']) {
    assert.ok(key in results[0], `missing ${key}`);
  }
});
