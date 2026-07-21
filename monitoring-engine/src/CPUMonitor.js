/**
 * @file Real CPU usage monitoring via Node's built-in `os` module —
 * no external dependency or DI needed, since CPU introspection is a
 * standard, cross-platform Node capability.
 * @module monitoring-engine/CPUMonitor
 */

import os from 'node:os';

/**
 * Compute the aggregate CPU busy-time snapshot across all cores.
 * @returns {{idle: number, total: number}}
 * @private
 */
function snapshotCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

export class CPUMonitor {
  constructor() {
    /** @private */ this._lastSnapshot = snapshotCpuTimes();
  }

  /**
   * Percentage CPU busy since the previous call (or since
   * construction, on the first call) — a real instantaneous-usage
   * reading, not `os.loadavg()`'s longer-window average.
   * @returns {number} 0..100.
   */
  getUsagePct() {
    const current = snapshotCpuTimes();
    const idleDelta = current.idle - this._lastSnapshot.idle;
    const totalDelta = current.total - this._lastSnapshot.total;
    this._lastSnapshot = current;
    if (totalDelta <= 0) return 0;
    return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
  }

  /**
   * @returns {{load1: number, load5: number, load15: number}} 1/5/15-minute load averages (POSIX-only; returns zeros on platforms without load average support, e.g. Windows).
   */
  getLoadAverage() {
    const [load1, load5, load15] = os.loadavg();
    return { load1, load5, load15 };
  }

  /**
   * @returns {number} Logical core count.
   */
  getCoreCount() {
    return os.cpus().length;
  }

  /**
   * @returns {{usagePct: number, coreCount: number, loadAverage: {load1: number, load5: number, load15: number}}}
   */
  snapshot() {
    return { usagePct: this.getUsagePct(), coreCount: this.getCoreCount(), loadAverage: this.getLoadAverage() };
  }
}

export default CPUMonitor;
