import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HealthChecker, HealthStatus } from '../src/HealthChecker.js';
import { createConfig } from '../src/Config.js';

const hc = new HealthChecker(createConfig().healthCheck);

test('a successful check without an explicit status defaults to HEALTHY', async () => {
  const result = await hc.check('svc1', async () => ({ message: 'all good' }));
  assert.equal(result.status, HealthStatus.HEALTHY);
  assert.ok(result.latencyMs >= 0);
});

test('an explicit status in the check result is respected', async () => {
  const result = await hc.check('svc2', async () => ({ status: HealthStatus.WARNING }));
  assert.equal(result.status, HealthStatus.WARNING);
});

test('a throwing check is classified CRITICAL and never propagates', async () => {
  const result = await hc.check('svc3', async () => { throw new Error('connection refused'); });
  assert.equal(result.status, HealthStatus.CRITICAL);
  assert.equal(result.message, 'connection refused');
});

test('a hanging check is classified OFFLINE on timeout', async () => {
  const result = await hc.check('svc4', () => new Promise(() => {}), 50);
  assert.equal(result.status, HealthStatus.OFFLINE);
});

test('checkAll runs multiple named checks concurrently', async () => {
  const results = await hc.checkAll({ a: async () => ({ status: HealthStatus.HEALTHY }), b: async () => ({ status: HealthStatus.CRITICAL }) });
  assert.equal(results.length, 2);
});

test('classifyThreshold correctly buckets percentage and millisecond metrics', () => {
  assert.equal(HealthChecker.classifyThreshold(95, { warnPct: 70, criticalPct: 90 }), HealthStatus.CRITICAL);
  assert.equal(HealthChecker.classifyThreshold(75, { warnPct: 70, criticalPct: 90 }), HealthStatus.WARNING);
  assert.equal(HealthChecker.classifyThreshold(30, { warnPct: 70, criticalPct: 90 }), HealthStatus.HEALTHY);
  assert.equal(HealthChecker.classifyThreshold(600, { warnMs: 100, criticalMs: 500 }), HealthStatus.CRITICAL);
});
