/**
 * @file Network IO monitoring. Node has no standard cross-platform
 * API for network throughput counters. On Linux (this platform's
 * deployment target), real cumulative byte counters are read from
 * `/proc/net/dev`; on any platform where that file is unavailable,
 * this module honestly reports `available: false` rather than
 * fabricating a number — it never falls back to a fake reading.
 * @module monitoring-engine/NetworkMonitor
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';

/**
 * Parse `/proc/net/dev` into per-interface cumulative RX/TX byte counters.
 * @param {string} content
 * @returns {Object.<string, {rxBytes: number, txBytes: number}>}
 * @private
 */
function parseProcNetDev(content) {
  const lines = content.trim().split('\n').slice(2); // skip the two header lines
  const result = {};
  for (const line of lines) {
    const [iface, rest] = line.split(':');
    if (!rest) continue;
    const fields = rest.trim().split(/\s+/).map(Number);
    result[iface.trim()] = { rxBytes: fields[0], txBytes: fields[8] };
  }
  return result;
}

export class NetworkMonitor {
  constructor() {
    /** @private @type {{timestamp: number, counters: Object.<string, {rxBytes: number, txBytes: number}>}|null} */
    this._lastSnapshot = null;
  }

  /**
   * @returns {Promise<{available: boolean, interfaces: Object.<string, {rxBytes: number, txBytes: number}>}>} Cumulative byte counters since boot, per interface.
   */
  async getCumulativeCounters() {
    try {
      const content = await fs.readFile('/proc/net/dev', 'utf8');
      return { available: true, interfaces: parseProcNetDev(content) };
    } catch {
      return { available: false, interfaces: {} };
    }
  }

  /**
   * Compute per-second throughput since the previous call, summed
   * across all interfaces except loopback.
   * @returns {Promise<{available: boolean, rxBytesPerSec: number, txBytesPerSec: number}>}
   */
  async getThroughput() {
    const now = Date.now();
    const current = await this.getCumulativeCounters();
    if (!current.available) return { available: false, rxBytesPerSec: 0, txBytesPerSec: 0 };

    if (!this._lastSnapshot) {
      this._lastSnapshot = { timestamp: now, counters: current.interfaces };
      return { available: false, rxBytesPerSec: 0, txBytesPerSec: 0 }; // no baseline yet on the first call
    }

    const elapsedSec = Math.max(0.001, (now - this._lastSnapshot.timestamp) / 1000);
    let rxDelta = 0;
    let txDelta = 0;
    for (const [iface, counters] of Object.entries(current.interfaces)) {
      if (iface === 'lo') continue;
      const prev = this._lastSnapshot.counters[iface];
      if (!prev) continue;
      rxDelta += Math.max(0, counters.rxBytes - prev.rxBytes);
      txDelta += Math.max(0, counters.txBytes - prev.txBytes);
    }

    this._lastSnapshot = { timestamp: now, counters: current.interfaces };
    return { available: true, rxBytesPerSec: rxDelta / elapsedSec, txBytesPerSec: txDelta / elapsedSec };
  }

  /**
   * @returns {string[]} Local network interface names (real, via `os.networkInterfaces()` — always available cross-platform).
   */
  getInterfaceNames() {
    return Object.keys(os.networkInterfaces());
  }
}

export default NetworkMonitor;
