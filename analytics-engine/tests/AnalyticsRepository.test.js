import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsRepository, InMemoryAnalyticsRepository } from '../src/AnalyticsRepository.js';

test('AnalyticsRepository cannot be instantiated directly', () => {
  assert.throws(() => new AnalyticsRepository());
});

test('an incomplete subclass rejects with a clear not-implemented message', async () => {
  class Incomplete extends AnalyticsRepository {}
  await assert.rejects(() => new Incomplete().saveTrade({}), /does not implement/);
});

test('saveTrade + getTrades round-trip, and getTrades never returns a live internal reference', async () => {
  const repo = new InMemoryAnalyticsRepository();
  await repo.saveTrade({ id: 't1', symbol: 'BTCUSDT', realizedPnl: 10, closedAt: 1 });
  const result1 = await repo.getTrades();
  result1.push({ id: 'fake' }); // mutate the returned array
  const result2 = await repo.getTrades();
  assert.equal(result2.length, 1); // internal state unaffected by the external mutation
});

test('getTrades filters by strategy and time range', async () => {
  const repo = new InMemoryAnalyticsRepository();
  await repo.saveTrade({ id: 't1', strategy: 'A', closedAt: 1000, realizedPnl: 1 });
  await repo.saveTrade({ id: 't2', strategy: 'B', closedAt: 5000, realizedPnl: 1 });
  assert.equal((await repo.getTrades({ strategy: 'A' })).length, 1);
  assert.equal((await repo.getTrades({ since: 2000 })).length, 1);
});

test('streamTrades yields correctly-sized batches covering all trades', async () => {
  const repo = new InMemoryAnalyticsRepository({ batchSize: 3 });
  for (let i = 0; i < 10; i++) await repo.saveTrade({ id: `t${i}`, realizedPnl: i, closedAt: i });
  let batchCount = 0;
  let total = 0;
  for await (const batch of repo.streamTrades()) {
    batchCount++;
    total += batch.length;
  }
  assert.equal(batchCount, 4);
  assert.equal(total, 10);
});

test('saveReport + getReports round-trip, filterable by period', async () => {
  const repo = new InMemoryAnalyticsRepository();
  await repo.saveReport({ period: 'daily', netProfit: 100 });
  await repo.saveReport({ period: 'weekly', netProfit: 500 });
  assert.equal((await repo.getReports({ period: 'daily' })).length, 1);
  assert.equal((await repo.getReports()).length, 2);
});
