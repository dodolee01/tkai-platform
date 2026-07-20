import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExposureCalculator } from '../src/ExposureCalculator.js';
import { createConfig } from '../src/Config.js';

function makeCalculator(overrides = {}) {
  return new ExposureCalculator(createConfig({ exposure: overrides }).exposure);
}

test('total/long/short exposure are computed correctly', () => {
  const calc = makeCalculator();
  const positions = [
    { symbol: 'BTCUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 1000 },
    { symbol: 'ETHUSDT', side: 'SHORT', remainingQuantity: 2, markPrice: 500 },
  ];
  const report = calc.computeExposure(positions, 10000);
  assert.equal(report.longExposure, 1000);
  assert.equal(report.shortExposure, 1000);
  assert.equal(report.totalExposure, 2000);
});

test('symbolExposure and assetExposure extract the base asset correctly', () => {
  const calc = makeCalculator();
  const positions = [{ symbol: 'BTCUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 1000 }];
  const report = calc.computeExposure(positions, 10000);
  assert.equal(report.symbolExposure.BTCUSDT, 0.1);
  assert.equal(report.assetExposure.BTC, 0.1);
});

test('sectorExposure and correlationExposure aggregate configured groups', () => {
  const calc = makeCalculator({ sectorMap: { BTCUSDT: 'majors', ETHUSDT: 'majors' }, correlationGroups: { BTCUSDT: 'g1', ETHUSDT: 'g1' } });
  const positions = [
    { symbol: 'BTCUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 500 },
    { symbol: 'ETHUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 500 },
  ];
  const report = calc.computeExposure(positions, 10000);
  assert.equal(report.sectorExposure.majors, 0.1);
  assert.equal(report.correlationExposure.g1, 0.1);
});

test('unmapped symbols fall into "unclassified" sector but no correlation group entry', () => {
  const calc = makeCalculator();
  const positions = [{ symbol: 'XUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 100 }];
  const report = calc.computeExposure(positions, 10000);
  assert.equal(report.sectorExposure.unclassified, 0.01);
  assert.equal(Object.keys(report.correlationExposure).length, 0);
});

test('warnings fire for every exceeded limit type', () => {
  const calc = makeCalculator({ maxTotalExposurePct: 0.05, maxSymbolExposurePct: 0.05 });
  const positions = [{ symbol: 'BTCUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 1000 }];
  const report = calc.computeExposure(positions, 10000);
  assert.ok(report.warnings.some((w) => w.includes('total_exposure_exceeded')));
  assert.ok(report.warnings.some((w) => w.includes('symbol_exposure_exceeded')));
});

test('invalid equity returns a zeroed report with a specific warning', () => {
  const calc = makeCalculator();
  const report = calc.computeExposure([{ symbol: 'BTCUSDT', side: 'LONG', remainingQuantity: 1, markPrice: 1000 }], 0);
  assert.deepEqual(report.warnings, ['invalid_equity']);
  assert.equal(report.totalExposure, 0);
});

test('an empty position list produces zero exposure with no warnings', () => {
  const calc = makeCalculator();
  const report = calc.computeExposure([], 10000);
  assert.equal(report.totalExposure, 0);
  assert.equal(report.warnings.length, 0);
});
