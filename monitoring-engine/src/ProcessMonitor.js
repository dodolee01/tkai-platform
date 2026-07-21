/**
 * @file Real Node.js process-level monitoring: PID, uptime, resource
 * usage, file descriptor count, event loop delay, and garbage
 * collection activity — all via Node's built-in `process` and
 * `perf_hooks` modules. File descriptor count is read from Linux's
 * `/proc/self/fd` (real on this platform's deployment target);
 * thread count is approximated from `process.resourceUsage()`'s
 * `userCPUUsage`/`systemCPUUsage` sampling behavior is NOT reliable
 * for a true thread count in pure Node without a native addon, so
 * this module honestly reports only the libuv threadpool size
 * (`UV_THREADPOOL_SIZE`, always known) rather than fabricating an OS
 * thread count.
 * @module monitoring-engine/ProcessMonitor
 */

import { promises as fs } from 'node:fs';
import { monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';

export class ProcessMonitor {
  constructor() {
    /** @private */ this._eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
    this._eventLoopHistogram.enable();

    /** @private @type {{type: string, durationMs: number, timestamp: number}[]} */
    this._gcEvents = [];
    /** @private */ this._gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this._gcEvents.push({ type: gcKindName(entry.detail?.kind ?? entry.kind), durationMs: entry.duration, timestamp: Date.now() });
        if (this._gcEvents.length > 200) this._gcEvents.shift();
      }
    });
    this._gcObserver.observe({ entryTypes: ['gc'] });
  }

  /**
   * @returns {{pid: number, uptimeSec: number, nodeVersion: string, platform: string}}
   */
  getProcessInfo() {
    return { pid: process.pid, uptimeSec: process.uptime(), nodeVersion: process.version, platform: process.platform };
  }

  /**
   * @returns {{userCpuMs: number, systemCpuMs: number, maxRssBytes: number}}
   */
  getResourceUsage() {
    const usage = process.resourceUsage();
    return { userCpuMs: usage.userCPUTime / 1000, systemCpuMs: usage.systemCPUTime / 1000, maxRssBytes: usage.maxRSS * 1024 };
  }

  /**
   * @returns {Promise<{available: boolean, count: number}>} Real open file descriptor count on Linux; `available: false` on platforms without `/proc/self/fd`.
   */
  async getFileDescriptorCount() {
    try {
      const entries = await fs.readdir('/proc/self/fd');
      return { available: true, count: entries.length };
    } catch {
      return { available: false, count: 0 };
    }
  }

  /**
   * @returns {number} The libuv threadpool size (real, from the `UV_THREADPOOL_SIZE` environment variable or its default of 4).
   */
  getThreadPoolSize() {
    return Number(process.env.UV_THREADPOOL_SIZE) || 4;
  }

  /**
   * @returns {{minMs: number, maxMs: number, meanMs: number, p50Ms: number, p99Ms: number}} Real event-loop-delay histogram statistics since monitoring began (or the last {@link ProcessMonitor#resetEventLoopStats} call).
   */
  getEventLoopDelay() {
    const h = this._eventLoopHistogram;
    return {
      minMs: h.min / 1e6,
      maxMs: h.max / 1e6,
      meanMs: h.mean / 1e6,
      p50Ms: h.percentile(50) / 1e6,
      p99Ms: h.percentile(99) / 1e6,
    };
  }

  /**
   * @returns {void}
   */
  resetEventLoopStats() {
    this._eventLoopHistogram.reset();
  }

  /**
   * @param {number} [limit] - Most recent N events; all (up to 200) if omitted.
   * @returns {{type: string, durationMs: number, timestamp: number}[]}
   */
  getRecentGCEvents(limit) {
    return limit === undefined ? this._gcEvents.slice() : this._gcEvents.slice(-limit);
  }

  /**
   * Stop the underlying perf_hooks observers. Call on shutdown to
   * release the event-loop-delay histogram and GC observer.
   * @returns {void}
   */
  stop() {
    this._eventLoopHistogram.disable();
    this._gcObserver.disconnect();
  }

  /**
   * @returns {Promise<object>}
   */
  async snapshot() {
    return {
      processInfo: this.getProcessInfo(),
      resourceUsage: this.getResourceUsage(),
      fileDescriptors: await this.getFileDescriptorCount(),
      threadPoolSize: this.getThreadPoolSize(),
      eventLoopDelay: this.getEventLoopDelay(),
      recentGC: this.getRecentGCEvents(10),
    };
  }
}

/**
 * @param {number} kind
 * @returns {string}
 * @private
 */
function gcKindName(kind) {
  // Matches Node's perf_hooks constants.NODE_PERFORMANCE_GC_* values.
  const names = { 1: 'scavenge', 2: 'markSweepCompact', 4: 'incrementalMarking', 8: 'processWeakCallbacks', 16: 'all' };
  return names[kind] ?? `unknown(${kind})`;
}

export default ProcessMonitor;
