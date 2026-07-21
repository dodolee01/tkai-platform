/**
 * @file Real disk usage monitoring via Node's `fs.promises.statfs`
 * (available since Node 18.15/19) — real filesystem statistics for
 * the configured path, no DI needed for usage figures. Disk IO
 * (read/write throughput) has no standard cross-platform Node API,
 * so that figure is supplied via an optional injected sampler,
 * honestly returning `available: false` when none is provided rather
 * than fabricating a number.
 * @module monitoring-engine/DiskMonitor
 */

import { promises as fs } from 'node:fs';

export class DiskMonitor {
  /**
   * @param {Object} [deps]
   * @param {() => Promise<{readBytesPerSec: number, writeBytesPerSec: number}>} [deps.ioSampler] - Optional injected disk-IO sampler (platform-specific; no standard Node API exists).
   */
  constructor({ ioSampler } = {}) {
    /** @private */ this._ioSampler = ioSampler ?? null;
  }

  /**
   * @param {string} path
   * @returns {Promise<{totalBytes: number, freeBytes: number, usedBytes: number, usedPct: number}>}
   */
  async getUsage(path) {
    const stat = await fs.statfs(path);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bavail * stat.bsize;
    const usedBytes = totalBytes - freeBytes;
    return { totalBytes, freeBytes, usedBytes, usedPct: totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100 };
  }

  /**
   * @returns {Promise<{available: boolean, readBytesPerSec: number, writeBytesPerSec: number}>}
   */
  async getIO() {
    if (!this._ioSampler) return { available: false, readBytesPerSec: 0, writeBytesPerSec: 0 };
    const sample = await this._ioSampler();
    return { available: true, readBytesPerSec: sample.readBytesPerSec, writeBytesPerSec: sample.writeBytesPerSec };
  }

  /**
   * @param {string} path
   * @returns {Promise<{usage: object, io: object}>}
   */
  async snapshot(path) {
    return { usage: await this.getUsage(path), io: await this.getIO() };
  }
}

export default DiskMonitor;
