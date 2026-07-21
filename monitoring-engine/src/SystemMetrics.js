/**
 * @file Aggregates CPU, memory, disk, network, and process metrics
 * into a single system-health snapshot, and classifies each against
 * configured thresholds via {@link HealthChecker}.
 * @module monitoring-engine/SystemMetrics
 */

import { HealthChecker, HealthStatus } from './HealthChecker.js';

export class SystemMetrics {
  /**
   * @param {Object} deps
   * @param {import('./CPUMonitor.js').CPUMonitor} deps.cpuMonitor
   * @param {import('./MemoryMonitor.js').MemoryMonitor} deps.memoryMonitor
   * @param {import('./DiskMonitor.js').DiskMonitor} deps.diskMonitor
   * @param {import('./NetworkMonitor.js').NetworkMonitor} deps.networkMonitor
   * @param {import('./ProcessMonitor.js').ProcessMonitor} deps.processMonitor
   * @param {import('./MetricsCollector.js').MetricsCollector} deps.metricsCollector
   * @param {object} config - `config.thresholds` and `config.disk` sections.
   */
  constructor({ cpuMonitor, memoryMonitor, diskMonitor, networkMonitor, processMonitor, metricsCollector }, config) {
    /** @private */ this._cpuMonitor = cpuMonitor;
    /** @private */ this._memoryMonitor = memoryMonitor;
    /** @private */ this._diskMonitor = diskMonitor;
    /** @private */ this._networkMonitor = networkMonitor;
    /** @private */ this._processMonitor = processMonitor;
    /** @private */ this._metricsCollector = metricsCollector;
    /** @private */ this._config = config;
  }

  /**
   * Take a full system snapshot, record every metric into the
   * {@link MetricsCollector} for trend analysis, and classify overall
   * system health.
   * @returns {Promise<{status: import('./types.js').HealthStatus, cpu: object, memory: object, disk: object, network: object, process: object}>}
   */
  async collect() {
    const [cpu, memory, disk, network, proc] = await Promise.all([
      Promise.resolve(this._cpuMonitor.snapshot()),
      this._memoryMonitor.snapshot(),
      this._diskMonitor.snapshot(this._config.disk.monitoredPath),
      this._networkMonitor.getThroughput(),
      this._processMonitor.snapshot(),
    ]);

    const now = Date.now();
    this._metricsCollector.record('system.cpu.usagePct', cpu.usagePct, '%', now);
    this._metricsCollector.record('system.memory.usedPct', memory.system.usedPct, '%', now);
    this._metricsCollector.record('system.memory.heapUsed', memory.process.heapUsed, 'bytes', now);
    this._metricsCollector.record('system.disk.usedPct', disk.usage.usedPct, '%', now);
    this._metricsCollector.record('system.eventLoop.delayMeanMs', proc.eventLoopDelay.meanMs, 'ms', now);

    const cpuStatus = HealthChecker.classifyThreshold(cpu.usagePct, this._config.thresholds.cpu);
    const memoryStatus = HealthChecker.classifyThreshold(memory.system.usedPct, this._config.thresholds.memory);
    const diskStatus = HealthChecker.classifyThreshold(disk.usage.usedPct, this._config.thresholds.disk);
    const eventLoopStatus = HealthChecker.classifyThreshold(proc.eventLoopDelay.meanMs, this._config.thresholds.eventLoopDelay);

    const statuses = [cpuStatus, memoryStatus, diskStatus, eventLoopStatus];
    const overallStatus = statuses.includes(HealthStatus.CRITICAL)
      ? HealthStatus.CRITICAL
      : statuses.includes(HealthStatus.WARNING)
        ? HealthStatus.WARNING
        : HealthStatus.HEALTHY;

    return {
      status: overallStatus,
      cpu: { ...cpu, status: cpuStatus },
      memory: { ...memory, status: memoryStatus },
      disk: { ...disk, status: diskStatus },
      network,
      process: { ...proc, status: eventLoopStatus },
    };
  }
}

export default SystemMetrics;
