import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePeriodRange, generatePeriodReport, generateCustomReport } from '../src/ReportGenerator.js';
import { createConfig } from '../src/Config.js';

test('resolvePeriodRange computes correct boundaries for every standard period type', () => {
  const ref = Date.parse('2026-03-15T12:00:00Z');
  const daily = resolvePeriodRange('daily', ref);
  assert.equal(daily.until - daily.since, 24 * 60 * 60 * 1000 - 1);

  const monthly = resolvePeriodRange('monthly', ref);
  assert.equal(new Date(monthly.since).getUTCDate(), 1);
  assert.equal(new Date(monthly.since).getUTCMonth(), 2);

  const quarterly = resolvePeriodRange('quarterly', ref);
  assert.equal(new Date(quarterly.since).getUTCMonth(), 0); // March is in Q1

  const yearly = resolvePeriodRange('yearly', ref);
  assert.equal(new Date(yearly.since).getUTCMonth(), 0);
  assert.equal(new Date(yearly.since).getUTCDate(), 1);
});

test('resolvePeriodRange throws on an unknown period type', () => {
  assert.throws(() => resolvePeriodRange('bogus', Date.now()));
});

test('generatePeriodReport filters trades to only those within the resolved period', () => {
  const config = createConfig();
  const ref = Date.parse('2026-03-15T12:00:00Z');
  const inRange = Date.parse('2026-03-15T10:00:00Z');
  const outOfRange = Date.parse('2026-04-01T10:00:00Z');
  const trades = [
    { realizedPnl: 100, closedAt: inRange, openedAt: inRange - 1000 },
    { realizedPnl: 50, closedAt: outOfRange, openedAt: outOfRange - 1000 },
  ];
  const report = generatePeriodReport(trades, 'daily', ref, config);
  assert.equal(report.trade.totalTrades, 1);
});

test('a generated report bundles trade, profit, loss, performance, and drawdown', () => {
  const config = createConfig();
  const report = generateCustomReport([{ realizedPnl: 10, closedAt: 1, openedAt: 0 }], 0, 100, config);
  for (const key of ['trade', 'profit', 'loss', 'performance', 'drawdown', 'since', 'until', 'generatedAt']) {
    assert.ok(key in report, `missing ${key}`);
  }
});
