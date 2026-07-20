import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExposureManager } from '../src/ExposureManager.js';
import { createConfig } from '../src/Config.js';

function makeManager(overrides = {}) {
  return new ExposureManager(createConfig({ exposure: overrides }).exposure);
}

test('total portfolio exposure sums all position notionals as a percent of equity', () => {
  const em = makeManager();
  const positions = [{ symbol: 'A', remainingQuantity: 1, markPrice: 1000 }, { symbol: 'B', remainingQuantity: 2, markPrice: 500 }];
  const exposure = em.computeExposure(positions, 10000);
  assert.equal(exposure.totalPortfolioExposurePct, 20); // (1000+1000)/10000*100
});

test('symbol exposure is tracked independently per symbol', () => {
  const em = makeManager();
  const positions = [{ symbol: 'A', remainingQuantity: 1, markPrice: 500 }, { symbol: 'B', remainingQuantity: 1, markPrice: 300 }];
  const exposure = em.computeExposure(positions, 10000);
  assert.equal(exposure.symbolExposurePct.A, 5);
  assert.equal(exposure.symbolExposurePct.B, 3);
});

test('sector exposure aggregates positions sharing a configured sector', () => {
  const em = makeManager({ sectorMap: { A: 'majors', B: 'majors', C: 'alts' } });
  const positions = [
    { symbol: 'A', remainingQuantity: 1, markPrice: 500 },
    { symbol: 'B', remainingQuantity: 1, markPrice: 500 },
    { symbol: 'C', remainingQuantity: 1, markPrice: 1000 },
  ];
  const exposure = em.computeExposure(positions, 10000);
  assert.equal(exposure.sectorExposurePct.majors, 10);
  assert.equal(exposure.sectorExposurePct.alts, 10);
});

test('symbols with no sector mapping fall into "unclassified"', () => {
  const em = makeManager({ sectorMap: {} });
  const exposure = em.computeExposure([{ symbol: 'X', remainingQuantity: 1, markPrice: 100 }], 10000);
  assert.equal(exposure.sectorExposurePct.unclassified, 1);
});

test('correlation group exposure only includes symbols with a configured group', () => {
  const em = makeManager({ correlationGroups: { A: 'group1' } });
  const positions = [{ symbol: 'A', remainingQuantity: 1, markPrice: 500 }, { symbol: 'B', remainingQuantity: 1, markPrice: 500 }];
  const exposure = em.computeExposure(positions, 10000);
  assert.equal(exposure.correlationGroupExposurePct.group1, 5);
  assert.equal(Object.keys(exposure.correlationGroupExposurePct).length, 1); // B has no group
});

test('warnings fire when any limit is exceeded', () => {
  const em = makeManager({ maxSymbolExposurePct: 0.02 });
  const exposure = em.computeExposure([{ symbol: 'A', remainingQuantity: 1, markPrice: 500 }], 10000);
  assert.ok(exposure.warnings.some((w) => w.includes('symbol_exposure_exceeded')));
});

test('no warnings when everything is within configured limits', () => {
  const em = makeManager({ maxPortfolioExposurePct: 0.9, maxSymbolExposurePct: 0.9, maxSectorExposurePct: 0.9, maxCorrelatedExposurePct: 0.9 });
  const exposure = em.computeExposure([{ symbol: 'A', remainingQuantity: 1, markPrice: 500 }], 10000);
  assert.equal(exposure.warnings.length, 0);
});

test('invalid (non-positive) equity is reported as a warning with zeroed output', () => {
  const em = makeManager();
  const exposure = em.computeExposure([{ symbol: 'A', remainingQuantity: 1, markPrice: 500 }], 0);
  assert.ok(exposure.warnings.includes('invalid_equity'));
  assert.equal(exposure.totalPortfolioExposurePct, 0);
});
