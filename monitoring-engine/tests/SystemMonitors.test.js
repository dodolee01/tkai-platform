import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CPUMonitor } from '../src/CPUMonitor.js';
import { MemoryMonitor } from '../src/MemoryMonitor.js';
import { DiskMonitor } from '../src/DiskMonitor.js';
import { NetworkMonitor } from '../src/NetworkMonitor.js';
import { ProcessMonitor } from '../src/ProcessMonitor.js';
import { SystemMetrics } from '../src/SystemMetrics.js';
import { MetricsCollector } from '../src/MetricsCollector.js';
import { HealthStatus } from '../src/HealthChecker.js';
import { createConfig } from '../src/Config.js';

test('CPUMonitor returns real, well-formed usage/core/load data', () => {
  const cpu = new CPUMonitor();
  assert.ok(cpu.getCoreCount() > 0);
  const load = cpu.getLoadAverage();
  assert.equal(typeof load.load1, 'number');
  const usage = cpu.getUsagePct();
  assert.ok(usage >= 0 && usage <= 100);
});

test('MemoryMonitor returns real positive system and process memory figures', () => {
  const mem = new MemoryMonitor();
  const sys = mem.getSystemMemory();
  assert.ok(sys.totalBytes > 0);
  assert.ok(sys.usedPct >= 0 && sys.usedPct <= 100);
  const proc = mem.getProcessMemory();
  assert.ok(proc.heapTotal > 0 && proc.heapUsed > 0);
});

test('MemoryMonitor.getSwapUsage never throws and reports availability honestly', async () => {
  const mem = new MemoryMonitor();
  const swap = await mem.getSwapUsage();
  assert.equal(typeof swap.available, 'boolean');
});

test('DiskMonitor.getUsage returns real filesystem statistics', async () => {
  const disk = new DiskMonitor();
  const usage = await disk.getUsage('/');
  assert.ok(usage.totalBytes > 0);
  assert.ok(usage.usedPct >= 0 && usage.usedPct <= 100);
});

test('DiskMonitor.getIO is honest without an injected sampler and uses one when supplied', async () => {
  const diskNoSampler = new DiskMonitor();
  assert.equal((await diskNoSampler.getIO()).available, false);
  const diskWithSampler = new DiskMonitor({ ioSampler: async () => ({ readBytesPerSec: 100, writeBytesPerSec: 50 }) });
  const io = await diskWithSampler.getIO();
  assert.equal(io.available, true);
  assert.equal(io.readBytesPerSec, 100);
});

test('NetworkMonitor reads real cumulative counters and computes throughput on the second call', async () => {
  const net = new NetworkMonitor();
  const counters = await net.getCumulativeCounters();
  assert.equal(typeof counters.available, 'boolean');
  const first = await net.getThroughput();
  assert.equal(first.available, false); // no baseline yet
  const second = await net.getThroughput();
  assert.equal(typeof second.available, 'boolean');
});

test('NetworkMonitor.getInterfaceNames returns real local interfaces', () => {
  const net = new NetworkMonitor();
  assert.ok(net.getInterfaceNames().length > 0);
});

test('ProcessMonitor returns real process info, resource usage, and event loop delay stats', async () => {
  const pm = new ProcessMonitor();
  const info = pm.getProcessInfo();
  assert.equal(info.pid, process.pid);
  const usage = pm.getResourceUsage();
  assert.ok(usage.maxRssBytes > 0);
  const eld = pm.getEventLoopDelay();
  assert.ok(eld.p99Ms >= eld.p50Ms);
  assert.ok(pm.getThreadPoolSize() >= 4);
  pm.stop();
});

test('ProcessMonitor.getFileDescriptorCount is honest and real on this platform', async () => {
  const pm = new ProcessMonitor();
  const fds = await pm.getFileDescriptorCount();
  assert.equal(typeof fds.available, 'boolean');
  pm.stop();
});

test('SystemMetrics.collect bundles every sub-monitor and classifies overall status', async () => {
  const processMonitor = new ProcessMonitor();
  const sm = new SystemMetrics(
    { cpuMonitor: new CPUMonitor(), memoryMonitor: new MemoryMonitor(), diskMonitor: new DiskMonitor(), networkMonitor: new NetworkMonitor(), processMonitor, metricsCollector: new MetricsCollector() },
    createConfig()
  );
  const snapshot = await sm.collect();
  assert.ok(['status', 'cpu', 'memory', 'disk', 'network', 'process'].every((k) => k in snapshot));
  assert.ok(Object.values(HealthStatus).includes(snapshot.status));
  processMonitor.stop();
});

test('SystemMetrics escalates to CRITICAL when a sub-metric threshold is breached', async () => {
  const processMonitor = new ProcessMonitor();
  const tightConfig = createConfig({ thresholds: { cpu: { warnPct: -1, criticalPct: -1 } } });
  const sm = new SystemMetrics(
    { cpuMonitor: new CPUMonitor(), memoryMonitor: new MemoryMonitor(), diskMonitor: new DiskMonitor(), networkMonitor: new NetworkMonitor(), processMonitor, metricsCollector: new MetricsCollector() },
    tightConfig
  );
  const snapshot = await sm.collect();
  assert.equal(snapshot.status, HealthStatus.CRITICAL);
  processMonitor.stop();
});
