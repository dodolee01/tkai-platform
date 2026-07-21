import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector } from '../src/MetricsCollector.js';

test('record/getHistory/getLatest/getAverage work correctly', () => {
  const mc = new MetricsCollector();
  mc.record('cpu', 10, '%', 0);
  mc.record('cpu', 20, '%', 1);
  mc.record('cpu', 30, '%', 2);
  assert.equal(mc.getHistory('cpu').length, 3);
  assert.equal(mc.getLatest('cpu').value, 30);
  assert.equal(mc.getAverage('cpu'), 20);
});

test('history is bounded by maxSamplesPerMetric with FIFO eviction', () => {
  const mc = new MetricsCollector(3);
  for (let i = 0; i < 5; i++) mc.record('x', i);
  assert.equal(mc.getHistory('x').length, 3);
  assert.equal(mc.getHistory('x')[0].value, 2); // 0,1 evicted
});

test('getTrendSlope recovers a known linear slope exactly', () => {
  const mc = new MetricsCollector();
  [10, 20, 30, 40, 50].forEach((v, i) => mc.record('heap', v, 'bytes', i));
  assert.ok(Math.abs(mc.getTrendSlope('heap', 5) - 10) < 1e-9);
});

test('getTrendSlope is ~0 for a flat series and 0 with fewer than 2 samples', () => {
  const mc = new MetricsCollector();
  [50, 50, 50].forEach((v, i) => mc.record('heap', v, 'bytes', i));
  assert.ok(Math.abs(mc.getTrendSlope('heap', 3)) < 1e-9);
  assert.equal(new MetricsCollector().getTrendSlope('nothing', 5), 0);
});

test('getMetricNames and clear work correctly', () => {
  const mc = new MetricsCollector();
  mc.record('cpu', 1);
  assert.ok(mc.getMetricNames().includes('cpu'));
  mc.clear('cpu');
  assert.equal(mc.getHistory('cpu').length, 0);
});
