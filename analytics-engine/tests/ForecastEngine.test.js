import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectSeries, forecastPerformance, forecastDrawdown, forecastGrowth } from '../src/ForecastEngine.js';
import { createConfig } from '../src/Config.js';

test('projectSeries continues a perfectly linear trend with a near-zero confidence band', () => {
  const history = [100, 102, 104, 106, 108, 110];
  const forecast = projectSeries(history, 5, 0.95, 3);
  assert.ok(Math.abs(forecast.pointEstimate - 120) < 1);
  assert.ok(forecast.upperBound - forecast.lowerBound < 0.01);
});

test('projectSeries bounds bracket the point estimate when there is residual noise', () => {
  const noisy = [100, 103, 101, 106, 104, 109, 107];
  const forecast = projectSeries(noisy, 5, 0.95, 3);
  assert.ok(forecast.lowerBound <= forecast.pointEstimate);
  assert.ok(forecast.upperBound >= forecast.pointEstimate);
});

test('projectSeries falls back to the last known value with insufficient history', () => {
  const forecast = projectSeries([100, 101], 10, 0.95, 5);
  assert.equal(forecast.pointEstimate, 101);
  assert.equal(forecast.lowerBound, 101);
});

test('forecastDrawdown clamps its bounds to non-negative values', () => {
  const config = createConfig({ forecast: { minHistoryPoints: 3 } }).forecast;
  const forecast = forecastDrawdown([5, 6, 4, 7, 5, 6, 8], config);
  assert.ok(forecast.lowerBound >= 0);
  assert.ok(forecast.pointEstimate >= 0);
});

test('forecastPerformance and forecastGrowth work end to end from an equity curve', () => {
  const config = createConfig().forecast;
  const equityCurve = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120].map((e, i) => ({ equity: e, timestamp: i * 86400000 }));
  const perfForecast = forecastPerformance(equityCurve, config);
  assert.equal(typeof perfForecast.pointEstimate, 'number');
  const growthForecast = forecastGrowth(equityCurve, config);
  assert.equal(typeof growthForecast.pointEstimate, 'number');
});

test('a higher confidence level produces a wider band than a lower one, given identical data', () => {
  const noisy = [100, 105, 98, 110, 95, 115, 90];
  const narrow = projectSeries(noisy, 5, 0.8, 3);
  const wide = projectSeries(noisy, 5, 0.99, 3);
  assert.ok(wide.upperBound - wide.lowerBound > narrow.upperBound - narrow.lowerBound);
});
