import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExposureManager } from '../src/ExposureManager.js';
import { createConfig } from '../src/Config.js';

function makeManager(overrides = {}) {
  return new ExposureManager(createConfig({ exposure: overrides }).exposure);
}

test('openPosition/closePosition track and untrack a symbol', () => {
  const em = makeManager();
  em.openPosition({ symbol: 'BTCUSDT', notional: 1000, side: 'LONG', riskAmount: 10 });
  assert.equal(em.getOpenPositions().length, 1);
  em.closePosition('BTCUSDT');
  assert.equal(em.getOpenPositions().length, 0);
});

test('getPortfolioExposurePct sums all open notionals', () => {
  const em = makeManager();
  em.openPosition({ symbol: 'A', notional: 500, side: 'LONG', riskAmount: 5 });
  em.openPosition({ symbol: 'B', notional: 300, side: 'LONG', riskAmount: 3 });
  assert.equal(em.getPortfolioExposurePct(10000), 8);
});

test('getCorrelatedExposurePct aggregates only symbols sharing a group', () => {
  const em = makeManager({ correlationGroups: { A: 'majors', B: 'majors', C: 'alts' } });
  em.openPosition({ symbol: 'A', notional: 500, side: 'LONG', riskAmount: 5 });
  em.openPosition({ symbol: 'B', notional: 300, side: 'LONG', riskAmount: 3 });
  em.openPosition({ symbol: 'C', notional: 900, side: 'LONG', riskAmount: 9 });
  assert.equal(em.getCorrelatedExposurePct('A', 10000), 8); // only A+B
});

test('checkLimits flags every breached limit type', () => {
  const em = makeManager({ maxPortfolioExposurePct: 0.05, maxSymbolExposurePct: 0.02, maxCorrelatedExposurePct: 0.05, correlationGroups: {} });
  const result = em.checkLimits('BTCUSDT', 5000, 10000); // 50% of equity, way over every limit
  assert.equal(result.withinLimits, false);
  assert.ok(result.violations.includes('portfolio_exposure_exceeded'));
  assert.ok(result.violations.includes('symbol_exposure_exceeded'));
});

test('checkLimits allows a trade within every configured limit', () => {
  const em = makeManager({ maxPortfolioExposurePct: 0.5, maxSymbolExposurePct: 0.5, maxCorrelatedExposurePct: 0.5 });
  const result = em.checkLimits('BTCUSDT', 100, 10000);
  assert.equal(result.withinLimits, true);
});

test('reset clears all tracked positions', () => {
  const em = makeManager();
  em.openPosition({ symbol: 'A', notional: 100, side: 'LONG', riskAmount: 1 });
  em.reset();
  assert.equal(em.getOpenPositions().length, 0);
});
