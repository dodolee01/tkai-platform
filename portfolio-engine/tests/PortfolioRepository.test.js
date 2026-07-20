import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioRepository, InMemoryPortfolioRepository } from '../src/PortfolioRepository.js';
import { createSnapshot } from '../src/PortfolioSnapshot.js';

const equity = { currentEquity: 1000, dailyEquity: 1000, weeklyEquity: 1000, monthlyEquity: 1000, peakEquity: 1000, lowestEquity: 1000 };
const exposure = { totalExposure: 0, longExposure: 0, shortExposure: 0, symbolExposure: {}, assetExposure: {}, sectorExposure: {}, correlationExposure: {}, warnings: [] };
const allocation = { byAsset: {}, bySector: {}, byStrategy: {}, byExchange: {} };
const capital = { availableCapital: 1000, reservedCapital: 0, riskCapital: 0, maxDeployableCapital: 1000 };
const performance = { netProfit: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0, winRate: 0, averageTrade: 0, averageHoldingTimeMs: 0, roi: 0, cagr: 0, sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, recoveryFactor: 0 };

test('PortfolioRepository cannot be instantiated directly', () => {
  assert.throws(() => new PortfolioRepository());
});

test('an incomplete subclass rejects with a clear not-implemented message', async () => {
  class Incomplete extends PortfolioRepository {}
  const repo = new Incomplete();
  await assert.rejects(() => repo.saveBalance({}), /does not implement/);
});

test('saveBalance + getBalances round-trip, filterable by userId', async () => {
  const repo = new InMemoryPortfolioRepository();
  await repo.saveBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 1000, marginBalance: 1000, usedMargin: 0 });
  await repo.saveBalance({ asset: 'USDT', exchange: 'binance', userId: 'u2', walletBalance: 500, availableBalance: 500, marginBalance: 500, usedMargin: 0 });
  assert.equal((await repo.getBalances()).length, 2);
  assert.equal((await repo.getBalances('u1')).length, 1);
});

test('saveSnapshot stores an immutable record retrievable by granularity', async () => {
  const repo = new InMemoryPortfolioRepository();
  const snap = await repo.saveSnapshot(createSnapshot('weekly', equity, exposure, allocation, capital, performance));
  assert.ok(Object.isFrozen(snap));
  assert.equal((await repo.getSnapshots('weekly')).length, 1);
  assert.equal((await repo.getSnapshots('daily')).length, 0);
});

test('getLatestSnapshot returns the most recent record of a granularity, or null', async () => {
  const repo = new InMemoryPortfolioRepository();
  await repo.saveSnapshot(createSnapshot('daily', equity, exposure, allocation, capital, performance, 1000));
  const latest = await repo.saveSnapshot(createSnapshot('daily', equity, exposure, allocation, capital, performance, 5000));
  assert.equal((await repo.getLatestSnapshot('daily')).id, latest.id);
  assert.equal(await repo.getLatestSnapshot('monthly'), null);
});
