/**
 * @file PocketBase health monitoring — a thin, named wrapper over
 * {@link DatabaseMonitor}. PocketBase exposes a real, documented
 * `/api/health` REST endpoint; this module builds the correct
 * request for it, with the HTTP transport injected (no real network
 * access in this environment).
 * @module monitoring-engine/PocketBaseMonitor
 */

import { DatabaseMonitor } from './DatabaseMonitor.js';
import { HealthStatus } from './HealthChecker.js';

export class PocketBaseMonitor {
  /**
   * @param {Object} deps
   * @param {string} deps.baseUrl - e.g. `https://pb.tkai.finance`.
   * @param {import('./OpenAIProvider.js').HttpClient} deps.httpClient - Duck-typed fetch-like function (same shape used across this platform's other HTTP-based providers).
   * @param {import('./HealthChecker.js').HealthChecker} deps.healthChecker
   */
  constructor({ baseUrl, httpClient, healthChecker }) {
    if (typeof httpClient !== 'function') throw new Error('PocketBaseMonitor: httpClient dependency is required');
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._healthChecker = healthChecker;
    /** @private */ this._monitor = new DatabaseMonitor({
      name: 'pocketbase',
      ping: async () => {
        const response = await httpClient(`${baseUrl}/api/health`, { method: 'GET', headers: {} });
        if (!response.ok) throw new Error(`PocketBase health endpoint returned HTTP ${response.status}`);
        return {};
      },
      healthChecker,
    });
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async check() {
    return this._monitor.check();
  }
}

export default PocketBaseMonitor;
