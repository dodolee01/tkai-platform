import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetAllocation } from '../src/AssetAllocation.js';
import { createConfig } from '../src/Config.js';

function makeAllocation(overrides = {}) {
  return new AssetAllocation(createConfig({ exposure: overrides }).exposure);
}

test('byAsset allocates correctly by base asset', () => {
  const alloc = makeAllocation();
  const positions = [{ symbol: 'BTCUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 2000 }];
  const report = alloc.computeAllocation(positions, 10000);
  assert.equal(report.byAsset.BTC, 0.2);
});

test('bySector aggregates configured sector groups', () => {
  const alloc = makeAllocation({ sectorMap: { BTCUSDT: 'majors' } });
  const positions = [{ symbol: 'BTCUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 1000 }];
  const report = alloc.computeAllocation(positions, 10000);
  assert.equal(report.bySector.majors, 0.1);
});

test('byStrategy uses the supplied strategy map, defaulting to unclassified', () => {
  const alloc = makeAllocation();
  const positions = [
    { symbol: 'BTCUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 500 },
    { symbol: 'ETHUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 500 },
  ];
  const report = alloc.computeAllocation(positions, 10000, { BTCUSDT: 'trend' });
  assert.equal(report.byStrategy.trend, 0.05);
  assert.equal(report.byStrategy.unclassified, 0.05);
});

test('byExchange splits allocation across exchanges', () => {
  const alloc = makeAllocation();
  const positions = [
    { symbol: 'BTCUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 500 },
    { symbol: 'ETHUSDT', exchange: 'bybit', remainingQuantity: 1, markPrice: 500 },
  ];
  const report = alloc.computeAllocation(positions, 10000);
  assert.equal(report.byExchange.binance, 0.05);
  assert.equal(report.byExchange.bybit, 0.05);
});

test('zero total portfolio value returns empty percentage maps without throwing', () => {
  const alloc = makeAllocation();
  const positions = [{ symbol: 'BTCUSDT', exchange: 'binance', remainingQuantity: 1, markPrice: 500 }];
  const report = alloc.computeAllocation(positions, 0);
  assert.deepEqual(report.byAsset, {});
});
