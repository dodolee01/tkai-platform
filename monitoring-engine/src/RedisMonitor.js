/**
 * @file Redis health monitoring — a thin, named wrapper over
 * {@link DatabaseMonitor} (no logic duplicated) plus Redis-specific
 * details (memory usage, connected clients) sourced from an injected
 * `INFO`-style command function.
 * @module monitoring-engine/RedisMonitor
 */

import { DatabaseMonitor } from './DatabaseMonitor.js';

export class RedisMonitor {
  /**
   * @param {Object} deps
   * @param {() => Promise<{connectionCount?: number}>} deps.ping - Injected `PING` operation.
   * @param {() => Promise<{usedMemoryBytes: number, connectedClients: number}>} [deps.info] - Injected `INFO`-equivalent operation.
   * @param {import('./HealthChecker.js').HealthChecker} deps.healthChecker
   */
  constructor({ ping, info, healthChecker }) {
    /** @private */ this._monitor = new DatabaseMonitor({ name: 'redis', ping, healthChecker });
    /** @private */ this._info = info ?? null;
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async check() {
    return this._monitor.check();
  }

  /**
   * @returns {Promise<{available: boolean, usedMemoryBytes: number, connectedClients: number}>}
   */
  async getInfo() {
    if (!this._info) return { available: false, usedMemoryBytes: 0, connectedClients: 0 };
    const result = await this._info();
    return { available: true, usedMemoryBytes: result.usedMemoryBytes, connectedClients: result.connectedClients };
  }
}

export default RedisMonitor;
