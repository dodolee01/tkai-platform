import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/HeatmapGenerator.js';

function makeTrade(hour, dayOfMonth, pnl) {
  return { realizedPnl: pnl, closedAt: Date.UTC(2026, 0, dayOfMonth, hour) };
}

test('profit heatmap includes only winning trades and aggregates same cells', () => {
  const trades = [makeTrade(9, 5, 100), makeTrade(9, 5, 50), makeTrade(9, 5, -10)];
  const heatmap = H.generateProfitHeatmap(trades);
  assert.equal(heatmap.length, 1);
  assert.equal(heatmap[0].value, 150);
  assert.equal(heatmap[0].count, 2);
});

test('loss heatmap reports positive magnitudes', () => {
  const trades = [makeTrade(14, 5, -30), makeTrade(14, 5, -20)];
  const heatmap = H.generateLossHeatmap(trades);
  assert.equal(heatmap[0].value, 50);
});

test('trading time heatmap value equals trade count', () => {
  const trades = [makeTrade(9, 5, 100), makeTrade(9, 5, -50), makeTrade(9, 5, 20)];
  const heatmap = H.generateTradingTimeHeatmap(trades);
  assert.equal(heatmap[0].value, heatmap[0].count);
  assert.equal(heatmap[0].count, 3);
});

test('hourly performance always returns exactly 24 entries', () => {
  const perf = H.generateHourlyPerformance([makeTrade(9, 5, 100)]);
  assert.equal(perf.length, 24);
  assert.equal(perf[9].netPnl, 100);
  assert.equal(perf[3].tradeCount, 0);
});

test('daily performance groups correctly and sorts chronologically', () => {
  const perf = H.generateDailyPerformance([makeTrade(9, 5, 100), makeTrade(10, 6, -50)]);
  assert.equal(perf.length, 2);
  assert.ok(perf[0].date < perf[1].date);
});

test('monthly performance groups all same-month trades together', () => {
  const perf = H.generateMonthlyPerformance([makeTrade(9, 5, 100), makeTrade(10, 20, 50)]);
  assert.equal(perf.length, 1);
  assert.equal(perf[0].netPnl, 150);
});
