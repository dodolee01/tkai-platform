/**
 * @file Runtime metrics collector (CPU, memory, throughput, latency).
 * @module scanner/core/Metrics
 */

import { cpuUsage, memoryUsage } from 'node:process';
import { cpus } from 'node:os';

/**
 * @typedef {Object} MetricsSnapshot
 * @property {number} memoryRssMb
 * @property {number} memoryHeapUsedMb
 * @property {number} cpuPct - Approximate process CPU utilization since the last sample.
 * @property {number} messagesPerSec
 * @property {number} eventsPerSec
 * @property {number} reconnectCount
 * @property {number} droppedPackets
 * @property {number} avgWsLatencyMs
 * @property {Object.<string, number>} workerUtilization - workerId -> messages handled since last sample.
 */

/**
 * Runtime metrics collector.
 * Counters are incremented by other subsystems via the small,
 * allocation-free `record*` methods; `sample()` periodically turns
 * those counters into rates and resets them, so hot paths never
 * allocate objects just to report a count.
 */
export class Metrics {
  /**
   * @param {Object} [options]
   * @param {number} [options.sampleIntervalMs=5000]
   */
  constructor({ sampleIntervalMs = 5000 } = {}) {
    /** @type {number} */
    this.sampleIntervalMs = sampleIntervalMs;

    /** @private */ this._messageCount = 0;
    /** @private */ this._eventCount = 0;
    /** @private */ this._reconnectCount = 0;
    /** @private */ this._droppedPackets = 0;
    /** @private @type {number[]} */ this._latencySamples = [];
    /** @private @type {Map<string, number>} */ this._workerMessageCounts = new Map();

    /** @private */ this._lastCpuUsage = cpuUsage();
    /** @private */ this._lastSampleTime = Date.now();

    /** @private @type {MetricsSnapshot|null} */
    this._lastSnapshot = null;
  }

  /** @returns {void} */
  recordMessage() { this._messageCount += 1; }

  /** @returns {void} */
  recordEvent() { this._eventCount += 1; }

  /** @returns {void} */
  recordReconnect() { this._reconnectCount += 1; }

  /** @returns {void} */
  recordDroppedPacket() { this._droppedPackets += 1; }

  /**
   * @param {number} ms - Round-trip or ping-pong latency in milliseconds.
   * @returns {void}
   */
  recordLatency(ms) {
    this._latencySamples.push(ms);
    if (this._latencySamples.length > 200) this._latencySamples.shift();
  }

  /**
   * @param {string} workerId
   * @returns {void}
   */
  recordWorkerMessage(workerId) {
    this._workerMessageCounts.set(workerId, (this._workerMessageCounts.get(workerId) || 0) + 1);
  }

  /**
   * Compute a snapshot of current rates and reset the counters that
   * are rate-based (message/event counts, worker counts). Cumulative
   * counters (reconnects, dropped packets) are NOT reset.
   * @returns {MetricsSnapshot}
   */
  sample() {
    const now = Date.now();
    const elapsedSec = Math.max((now - this._lastSampleTime) / 1000, 0.001);

    const currentCpu = cpuUsage(this._lastCpuUsage); // delta since last call
    const cpuPct = ((currentCpu.user + currentCpu.system) / 1000 / elapsedSec / 10); // normalize to 0-100 per core

    const mem = memoryUsage();

    const avgWsLatencyMs = this._latencySamples.length
      ? this._latencySamples.reduce((a, b) => a + b, 0) / this._latencySamples.length
      : 0;

    const workerUtilization = Object.fromEntries(this._workerMessageCounts);

    const snapshot = {
      memoryRssMb: mem.rss / (1024 * 1024),
      memoryHeapUsedMb: mem.heapUsed / (1024 * 1024),
      cpuPct: Math.min(cpuPct, 100 * Math.max(1, cpus().length || 1)),
      messagesPerSec: this._messageCount / elapsedSec,
      eventsPerSec: this._eventCount / elapsedSec,
      reconnectCount: this._reconnectCount,
      droppedPackets: this._droppedPackets,
      avgWsLatencyMs,
      workerUtilization,
    };

    this._messageCount = 0;
    this._eventCount = 0;
    this._workerMessageCounts.clear();
    this._lastCpuUsage = cpuUsage();
    this._lastSampleTime = now;
    this._lastSnapshot = snapshot;

    return snapshot;
  }

  /**
   * @returns {MetricsSnapshot|null} The most recent snapshot, if `sample()` has been called.
   */
  get lastSnapshot() {
    return this._lastSnapshot;
  }
}

export default Metrics;
