import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRiskAnalytics } from '../src/RiskAnalytics.js';
import { computeConcentrationIndex, computePortfolioAnalytics } from '../src/PortfolioAnalytics.js';
import { computeDrawdownAnalytics } from '../src/DrawdownAnalytics.js';

test('DrawdownAnalytics computes max/current/average drawdown from an equity curve', () => {
  const curve = [
    { equity: 1000, timestamp: 0 }, { equity: 1200, timestamp: 1 },
    { equity: 900, timestamp: 2 }, { equity: 1300, timestamp: 3 }, { equity: 1200, timestamp: 4 },
  ];
  const dd = computeDrawdownAnalytics(curve);
  assert.ok(Math.abs(dd.maxDrawdownPct - 25) < 0.01);
  assert.equal(dd.episodeCount, 2);
});

test('RiskAnalytics computes exposure, margin usage, and a bounded composite risk score', () => {
  const equityCurve = [{ equity: 1000, timestamp: 0 }, { equity: 800, timestamp: 1 }];
  const snapshot = { equity: 10000, assetExposure: { BTC: 0.3, ETH: 0.2 }, usedMargin: 4000, totalMargin: 10000, leverage: 5 };
  const liqDistances = [{ distanceToLiquidationPct: 5, notionalPct: 3000 }, { distanceToLiquidationPct: 50, notionalPct: 1000 }];

  const report = computeRiskAnalytics(equityCurve, snapshot, liqDistances);
  assert.ok(Math.abs(report.riskExposurePct - 50) < 0.01);
  assert.equal(report.marginUsagePct, 40);
  assert.ok(report.portfolioRiskScore >= 0 && report.portfolioRiskScore <= 100);
  assert.ok(Math.abs(report.maxDrawdownPct - 20) < 0.01);
});

test('RiskAnalytics liquidationRiskScore is 0 with no position data', () => {
  const report = computeRiskAnalytics([], { equity: 1000, assetExposure: {}, usedMargin: 0, totalMargin: 1000, leverage: 1 }, []);
  assert.equal(report.liquidationRiskScore, 0);
});

test('concentration index: equal split is 1/n, full concentration is 1.0, empty is 0', () => {
  assert.ok(Math.abs(computeConcentrationIndex({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 }) - 0.25) < 1e-9);
  assert.equal(computeConcentrationIndex({ a: 1.0 }), 1.0);
  assert.equal(computeConcentrationIndex({}), 0);
});

test('PortfolioAnalytics computes capital utilization and largest allocation correctly', () => {
  const snapshot = { equity: 10000, assetExposure: { BTC: 0.4, ETH: 0.2 }, sectorExposure: {}, exchangeExposure: {}, strategyExposure: {}, usedMargin: 3000 };
  const report = computePortfolioAnalytics(snapshot);
  assert.equal(report.capitalUtilizationPct, 30);
  assert.equal(report.largestAssetAllocationPct, 40);
});
