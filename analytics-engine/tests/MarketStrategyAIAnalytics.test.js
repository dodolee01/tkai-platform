import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMarketAnalytics } from '../src/MarketAnalytics.js';
import { computeStrategyAnalytics } from '../src/StrategyAnalytics.js';
import { computeConfidenceCalibration, computeCalibrationError, computeAIAnalytics } from '../src/AIAnalytics.js';
import { createConfig } from '../src/Config.js';
import { monthKey } from '../src/StatisticsEngine.js';

test('MarketAnalytics classifies a clean low-volatility uptrend as trending', () => {
  const config = createConfig().market;
  const snapshots = [
    { symbol: 'BTCUSDT', timestamp: 0, price: 100, volatility: 0.01, volume: 1000, priceChangePct: 1 },
    { symbol: 'BTCUSDT', timestamp: 1, price: 102, volatility: 0.01, volume: 1200, priceChangePct: 2 },
    { symbol: 'BTCUSDT', timestamp: 2, price: 105, volatility: 0.01, volume: 900, priceChangePct: 3 },
  ];
  const report = computeMarketAnalytics(snapshots, config);
  assert.equal(report.regime, 'trending');
  assert.equal(report.marketBreadthPct, 100);
});

test('MarketAnalytics computes openInterestChangePct correctly', () => {
  const config = createConfig().market;
  const snapshots = [
    { symbol: 'X', timestamp: 0, price: 1, volatility: 0.01, volume: 1, priceChangePct: 0, openInterest: 100 },
    { symbol: 'X', timestamp: 1, price: 1, volatility: 0.01, volume: 1, priceChangePct: 0, openInterest: 110 },
  ];
  const report = computeMarketAnalytics(snapshots, config);
  assert.ok(Math.abs(report.openInterestChangePct - 10) < 0.01);
});

test('StrategyAnalytics groups by strategy and ranks by composite score', () => {
  const config = createConfig({ strategy: { minTradesForRanking: 2 } });
  const trades = [
    { strategy: 'trend', realizedPnl: 100, confidence: 0.8, closedAt: 1000, openedAt: 0 },
    { strategy: 'trend', realizedPnl: -30, confidence: 0.6, closedAt: 2000, openedAt: 500 },
    { strategy: 'trend', realizedPnl: 50, confidence: 0.7, closedAt: 3000, openedAt: 1500 },
    { strategy: 'meanRev', realizedPnl: -10, confidence: 0.5, closedAt: 4000, openedAt: 3500 },
    { strategy: 'meanRev', realizedPnl: -5, confidence: 0.5, closedAt: 5000, openedAt: 4500 },
  ];
  const reports = computeStrategyAnalytics(trades, config);
  assert.equal(reports.length, 2);
  assert.equal(reports[0].strategy, 'trend'); // the profitable strategy ranks first
  assert.ok(reports[0].rankScore >= reports[1].rankScore);
});

test('StrategyAnalytics leaves executionQuality null when no trade carries expectedEntryPrice', () => {
  const config = createConfig({ strategy: { minTradesForRanking: 1 } });
  const trades = [{ strategy: 'x', realizedPnl: 10, confidence: 0.5, closedAt: 1, openedAt: 0 }];
  const reports = computeStrategyAnalytics(trades, config);
  assert.equal(reports[0].executionQuality, null);
});

test('StrategyAnalytics assigns null rankScore below minTradesForRanking', () => {
  const config = createConfig({ strategy: { minTradesForRanking: 5 } });
  const trades = [{ strategy: 'tiny', realizedPnl: 10, confidence: 0.5, closedAt: 1, openedAt: 0 }];
  const reports = computeStrategyAnalytics(trades, config);
  assert.equal(reports[0].rankScore, null);
});

test('AIAnalytics computes decisionAccuracy and predictionAccuracy correctly, honestly nulling missing data', () => {
  const trades = [
    { realizedPnl: 100, confidence: 0.8, predictedDirectionCorrect: 1, closedAt: 1000 },
    { realizedPnl: -30, confidence: 0.6, predictedDirectionCorrect: 0, closedAt: 2000 },
    { realizedPnl: 50, confidence: 0.7, predictedDirectionCorrect: 1, closedAt: 3000 },
  ];
  const report = computeAIAnalytics(trades, monthKey);
  assert.equal(report.totalDecisions, 3);
  assert.ok(Math.abs(report.predictionAccuracy - 2 / 3) < 1e-9);
  assert.ok(Math.abs(report.decisionAccuracy - 2 / 3) < 1e-9);

  const noPrediction = [{ realizedPnl: 10, confidence: 0.5, closedAt: 1 }];
  assert.equal(computeAIAnalytics(noPrediction, monthKey).predictionAccuracy, null);
});

test('confidence calibration buckets and error are computed correctly for an overconfident model', () => {
  const trades = [];
  for (let i = 0; i < 10; i++) trades.push({ confidence: 0.9, realizedPnl: i % 2 === 0 ? 1 : -1, closedAt: i });
  const buckets = computeConfidenceCalibration(trades, 10);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].actualWinRate, 0.5);
  const error = computeCalibrationError(buckets);
  assert.ok(Math.abs(error - 0.4) < 1e-9); // |0.9 - 0.5|
});
