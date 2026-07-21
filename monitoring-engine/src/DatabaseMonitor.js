/**
 * @file Generic database health monitoring: measures ping/query
 * latency and reports connection count via an injected client
 * operation (Dependency Injection — this module never imports or
 * assumes a specific database driver). {@link RedisMonitor} and
 * {@link PocketBaseMonitor} build on this shared implementation
 * rather than duplicating the latency-measurement logic.
 * @module monitoring-engine/DatabaseMonitor
 */

import { HealthChecker, HealthStatus } from './HealthChecker.js';

export class DatabaseMonitor {
  /**
   * @param {Object} deps
   * @param {string} deps.name - e.g. 'pocketbase', 'postgresql', 'mongodb'.
   * @param {() => Promise<{connectionCount?: number}>} deps.ping - Injected ping/health-check operation for this database.
   * @param {import('./HealthChecker.js').HealthChecker} deps.healthChecker
   */
  constructor({ name, ping, healthChecker }) {
    if (typeof ping !== 'function') throw new Error('DatabaseMonitor: ping dependency is required');
    /** @private */ this._name = name;
    /** @private */ this._ping = ping;
    /** @private */ this._healthChecker = healthChecker;
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async check() {
    return this._healthChecker.check(this._name, async () => {
      const result = await this._ping();
      return { status: HealthStatus.HEALTHY, message: 'ping succeeded', details: { connectionCount: result?.connectionCount ?? null } };
    });
  }

  /**
   * Measure query latency, classified against `thresholds` (in ms).
   * @param {() => Promise<*>} queryFn - Injected representative query to time.
   * @param {{warnMs: number, criticalMs: number}} thresholds
   * @returns {Promise<{latencyMs: number, status: import('./types.js').HealthStatus}>}
   */
  async measureQueryLatency(queryFn, thresholds) {
    const startedAt = Date.now();
    await queryFn();
    const latencyMs = Date.now() - startedAt;
    return { latencyMs, status: HealthChecker.classifyThreshold(latencyMs, thresholds) };
  }
}

export default DatabaseMonitor;
