import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Watchdog } from '../src/Watchdog.js';
import { MetricsCollector } from '../src/MetricsCollector.js';
import { HeartbeatManager } from '../src/HeartbeatManager.js';
import { ServiceRegistry } from '../src/ServiceRegistry.js';
import { MonitoringEventPublisher } from '../src/MonitoringEvents.js';
import { createConfig } from '../src/Config.js';

function buildWatchdog(configOverrides = {}, processMonitor = { getEventLoopDelay: () => ({ meanMs: 5, p99Ms: 10 }) }) {
  const config = createConfig(configOverrides);
  const metricsCollector = new MetricsCollector();
  let now = 0;
  const registry = new ServiceRegistry();
  registry.register({ name: 'svc1', category: 'module' });
  const heartbeatManager = new HeartbeatManager({ serviceRegistry: registry, eventPublisher: new MonitoringEventPublisher() }, config.heartbeat, () => now);
  heartbeatManager.beat('svc1');
  const watchdog = new Watchdog({ metricsCollector, processMonitor, heartbeatManager }, config, () => now);
  return { watchdog, metricsCollector, heartbeatManager, setNow: (v) => { now = v; } };
}

test('checkCPUSpike requires consecutive over-threshold readings before flagging', () => {
  const { watchdog, metricsCollector } = buildWatchdog({ watchdog: { cpuSpikeSustainedChecks: 3 }, thresholds: { cpu: { criticalPct: 90 } } });
  metricsCollector.record('system.cpu.usagePct', 95);
  assert.equal(watchdog.checkCPUSpike().detected, false);
  metricsCollector.record('system.cpu.usagePct', 95);
  assert.equal(watchdog.checkCPUSpike().detected, false);
  metricsCollector.record('system.cpu.usagePct', 95);
  assert.equal(watchdog.checkCPUSpike().detected, true);
});

test('checkCPUSpike resets its streak once usage drops below threshold', () => {
  const { watchdog, metricsCollector } = buildWatchdog({ watchdog: { cpuSpikeSustainedChecks: 2 }, thresholds: { cpu: { criticalPct: 90 } } });
  metricsCollector.record('system.cpu.usagePct', 95);
  watchdog.checkCPUSpike();
  metricsCollector.record('system.cpu.usagePct', 95);
  assert.equal(watchdog.checkCPUSpike().detected, true);
  metricsCollector.record('system.cpu.usagePct', 10);
  assert.equal(watchdog.checkCPUSpike().consecutiveChecks, 0);
});

test('checkMemoryLeak flags sustained heap growth and ignores stable usage', () => {
  const growing = buildWatchdog({ watchdog: { memoryLeakWindowSize: 5, memoryLeakSlopeBytesPerSampleThreshold: 1000 } });
  [1000, 5000, 9000, 13000, 17000].forEach((v, i) => growing.metricsCollector.record('system.memory.heapUsed', v, 'bytes', i));
  assert.equal(growing.watchdog.checkMemoryLeak().suspected, true);

  const stable = buildWatchdog({ watchdog: { memoryLeakWindowSize: 5, memoryLeakSlopeBytesPerSampleThreshold: 1000 } });
  [1000, 1010, 990, 1005, 995].forEach((v, i) => stable.metricsCollector.record('system.memory.heapUsed', v, 'bytes', i));
  assert.equal(stable.watchdog.checkMemoryLeak().suspected, false);
});

test('checkEventLoopBlocking flags a severe delay and ignores a normal one', () => {
  const blocked = buildWatchdog({ thresholds: { eventLoopDelay: { criticalMs: 200 } } }, { getEventLoopDelay: () => ({ meanMs: 300, p99Ms: 600 }) });
  assert.equal(blocked.watchdog.checkEventLoopBlocking().detected, true);
  const normal = buildWatchdog({ thresholds: { eventLoopDelay: { criticalMs: 200 } } }, { getEventLoopDelay: () => ({ meanMs: 5, p99Ms: 10 }) });
  assert.equal(normal.watchdog.checkEventLoopBlocking().detected, false);
});

test('checkHungServices flags a service with no heartbeat past the hard timeout', () => {
  const { watchdog, setNow } = buildWatchdog({ watchdog: { hungServiceTimeoutMs: 5000 } });
  setNow(10000);
  assert.ok(watchdog.checkHungServices().includes('svc1'));
});

test('runAllChecks bundles every documented check', () => {
  const { watchdog } = buildWatchdog();
  const result = watchdog.runAllChecks();
  assert.ok(['cpuSpike', 'memoryLeak', 'eventLoopBlocking', 'hungServices'].every((k) => k in result));
});
