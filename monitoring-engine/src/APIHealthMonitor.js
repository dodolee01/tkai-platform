/**
 * @file Generic HTTP API endpoint health monitoring: real request
 * timing and status-code classification for any configured endpoint,
 * via an injected HTTP transport (consistent with this platform's
 * DI pattern for real network calls).
 * @module monitoring-engine/APIHealthMonitor
 */

import { HealthStatus } from './HealthChecker.js';

export class APIHealthMonitor {
  /**
   * @param {Object} deps
   * @param {import('./OpenAIProvider.js').HttpClient} deps.httpClient
   * @param {object} config - `config.api` section.
   */
  constructor({ httpClient }, config) {
    if (typeof httpClient !== 'function') throw new Error('APIHealthMonitor: httpClient dependency is required');
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._config = config;
  }

  /**
   * @param {string} name
   * @param {string} url
   * @param {{method?: string, headers?: object, timeoutMs?: number}} [options]
   * @returns {Promise<{name: string, status: import('./types.js').HealthStatus, statusCode: number|null, latencyMs: number, error: string|null}>}
   */
  async checkEndpoint(name, url, { method = 'GET', headers = {}, timeoutMs = this._config.defaultTimeoutMs } = {}) {
    const startedAt = Date.now();
    try {
      const response = await this._withTimeout(this._httpClient(url, { method, headers }), timeoutMs);
      const latencyMs = Date.now() - startedAt;
      return {
        name,
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.CRITICAL,
        statusCode: response.status,
        latencyMs,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      return { name, status: HealthStatus.OFFLINE, statusCode: null, latencyMs: Date.now() - startedAt, error: err.message };
    }
  }

  /**
   * @param {Object.<string, {url: string, method?: string, headers?: object}>} endpoints
   * @returns {Promise<object[]>}
   */
  async checkAll(endpoints) {
    return Promise.all(Object.entries(endpoints).map(([name, opts]) => this.checkEndpoint(name, opts.url, opts)));
  }

  /**
   * @param {Promise<*>} promise
   * @param {number} timeoutMs
   * @returns {Promise<*>}
   * @private
   */
  _withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
      promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
  }
}

export default APIHealthMonitor;
