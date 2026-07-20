import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, SnapshotScheduler } from '../src/PortfolioSnapshot.js';
import { createConfig } from '../src/Config.js';

function makeReports() {
  return {
    equity: { currentEquity: 1000, dailyEquity: 950, weeklyEquity: 900, monthlyEquity: 800, peakEquity: 1050, lowestEquity: 800 },
    exposure: { totalExposure: 100, longExposure: 100, shortExposure: 0, symbolExposure: { A: 0.1 }, assetExposure: {}, sectorExposure: {}, correlationExposure: {}, warnings: [] },
    allocation: { byAsset: { A: 0.1 }, bySector: {}, byStrategy: {}, byExchange: {} },
    capital: { availableCapital: 700, reservedCapital: 200, riskCapital: 350, maxDeployableCapital: 800 },
    performance: { netProfit: 50, grossProfit: 80, grossLoss: 30, profitFactor: 2.67, winRate: 0.6, averageTrade: 10, averageHoldingTimeMs: 5000, roi: 5, cagr: 20, sharpeRatio: 1.2, sortinoRatio: 1.5, calmarRatio: 2, recoveryFactor: 2 },
  };
}

test('createSnapshot produces a record with a unique id and the given timestamp', () => {
  const r = makeReports();
  const snap = createSnapshot('daily', r.equity, r.exposure, r.allocation, r.capital, r.performance, 12345);
  assert.equal(typeof snap.id, 'string');
  assert.equal(snap.timestamp, 12345);
  assert.equal(snap.granularity, 'daily');
});

test('createSnapshot is deeply immutable', () => {
  const r = makeReports();
  const snap = createSnapshot('realtime', r.equity, r.exposure, r.allocation, r.capital, r.performance);
  assert.ok(Object.isFrozen(snap));
  assert.ok(Object.isFrozen(snap.equity));
  assert.ok(Object.isFrozen(snap.exposure.symbolExposure));
  assert.throws(() => { 'use strict'; snap.equity.currentEquity = 9999; }, TypeError);
});

test('createSnapshot copies input objects rather than referencing them', () => {
  const r = makeReports();
  const snap = createSnapshot('realtime', r.equity, r.exposure, r.allocation, r.capital, r.performance);
  r.equity.currentEquity = 99999; // mutate the original after snapshotting
  assert.equal(snap.equity.currentEquity, 1000); // snapshot unaffected
});

test('SnapshotScheduler reports all granularities due on first check with a realistic epoch time', () => {
  const scheduler = new SnapshotScheduler(createConfig({ snapshot: { dailyIntervalMs: 1000, weeklyIntervalMs: 5000, monthlyIntervalMs: 20000 } }).snapshot);
  const due = scheduler.getDueGranularities(Date.now());
  assert.deepEqual(due.sort(), ['daily', 'monthly', 'weekly']);
});

test('SnapshotScheduler marks granularities taken and respects their intervals independently', () => {
  const scheduler = new SnapshotScheduler(createConfig({ snapshot: { dailyIntervalMs: 1000, weeklyIntervalMs: 5000, monthlyIntervalMs: 20000 } }).snapshot);
  const now = Date.now();
  scheduler.markTaken('daily', now);
  scheduler.markTaken('weekly', now);
  scheduler.markTaken('monthly', now);
  assert.deepEqual(scheduler.getDueGranularities(now + 500), []);
  assert.deepEqual(scheduler.getDueGranularities(now + 1500), ['daily']);
  assert.deepEqual(scheduler.getDueGranularities(now + 5500), ['daily', 'weekly']);
});
