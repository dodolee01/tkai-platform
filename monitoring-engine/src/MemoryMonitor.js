/**
 * @file Real memory usage monitoring: system-wide RAM via Node's
 * `os` module and process-level heap/RSS via `process.memoryUsage()`.
 * Both are standard, cross-platform Node capabilities — no DI needed.
 * @module monitoring-engine/MemoryMonitor
 */

import os from 'node:os';

export class MemoryMonitor {
  /**
   * @returns {{totalBytes: number, freeBytes: number, usedBytes: number, usedPct: number}}
   */
  getSystemMemory() {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    return { totalBytes, freeBytes, usedBytes, usedPct: totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100 };
  }

  /**
   * @returns {{rss: number, heapTotal: number, heapUsed: number, heapUsedPct: number, external: number, arrayBuffers: number}}
   */
  getProcessMemory() {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      heapUsedPct: mem.heapTotal === 0 ? 0 : (mem.heapUsed / mem.heapTotal) * 100,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers ?? 0,
    };
  }

  /**
   * Swap usage. Node has no built-in cross-platform swap API; this
   * reads Linux's `/proc/meminfo` when available (real, honest data
   * on this platform) and returns `available: false` elsewhere rather
   * than fabricating a number.
   * @returns {Promise<{available: boolean, totalBytes: number, usedBytes: number, usedPct: number}>}
   */
  async getSwapUsage() {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile('/proc/meminfo', 'utf8');
      const totalMatch = content.match(/SwapTotal:\s+(\d+)\s*kB/);
      const freeMatch = content.match(/SwapFree:\s+(\d+)\s*kB/);
      if (!totalMatch || !freeMatch) return { available: false, totalBytes: 0, usedBytes: 0, usedPct: 0 };
      const totalBytes = Number(totalMatch[1]) * 1024;
      const freeBytes = Number(freeMatch[1]) * 1024;
      const usedBytes = totalBytes - freeBytes;
      return { available: true, totalBytes, usedBytes, usedPct: totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100 };
    } catch {
      return { available: false, totalBytes: 0, usedBytes: 0, usedPct: 0 };
    }
  }

  /**
   * @returns {Promise<{system: object, process: object, swap: object}>}
   */
  async snapshot() {
    return { system: this.getSystemMemory(), process: this.getProcessMemory(), swap: await this.getSwapUsage() };
  }
}

export default MemoryMonitor;
