/**
 * @file Generic health-check runner: executes an injected check
 * function with a timeout, classifies the outcome into one of the 5
 * documented health statuses, and normalizes the result shape. Every
 * concrete monitor in this module (database, exchange, websocket,
 * API, AI, module) builds on this rather than reimplementing
 * timeout/classification logic itself.
 * @module monitoring-engine/HealthChecker
 */

/** @enum {string} */
export const HealthStatus = Object.freeze({
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
});

/**
 * @param {Promise<*>} promise
 * @param {number} timeoutMs
 * @returns {Promise<*>}
 * @private
 */
function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`health check timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export class HealthChecker {
  /**
   * @param {object} config - `config.healthCheck` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * Run a single health check function, returning a normalized
   * {@link import('./types.js').HealthCheckResult}. Never throws —
   * a check that times out or rejects is reported as OFFLINE/CRITICAL
   * rather than propagating the error to the caller.
   * @param {string} serviceName
   * @param {() => Promise<{status?: import('./types.js').HealthStatus, message?: string, details?: object}>} checkFn - Injected check implementation. May omit `status` to have it inferred as HEALTHY on success.
   * @param {number} [timeoutMs]
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async check(serviceName, checkFn, timeoutMs = this._config.timeoutMs) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(checkFn(), timeoutMs);
      return {
        serviceName,
        status: result?.status ?? HealthStatus.HEALTHY,
        message: result?.message ?? 'ok',
        details: result?.details ?? {},
        latencyMs: Date.now() - startedAt,
        checkedAt: Date.now(),
      };
    } catch (err) {
      const isTimeout = err.message.includes('timed out');
      return {
        serviceName,
        status: isTimeout ? HealthStatus.OFFLINE : HealthStatus.CRITICAL,
        message: err.message,
        details: {},
        latencyMs: Date.now() - startedAt,
        checkedAt: Date.now(),
      };
    }
  }

  /**
   * Run several named checks concurrently.
   * @param {Object.<string, () => Promise<object>>} checksByServiceName
   * @returns {Promise<import('./types.js').HealthCheckResult[]>}
   */
  async checkAll(checksByServiceName) {
    return Promise.all(
      Object.entries(checksByServiceName).map(([name, fn]) => this.check(name, fn))
    );
  }

  /**
   * Classify a numeric metric against warn/critical thresholds.
   * @param {number} value
   * @param {{warnPct?: number, criticalPct?: number, warnMs?: number, criticalMs?: number}} thresholds
   * @returns {import('./types.js').HealthStatus}
   */
  static classifyThreshold(value, thresholds) {
    const warn = thresholds.warnPct ?? thresholds.warnMs;
    const critical = thresholds.criticalPct ?? thresholds.criticalMs;
    if (value >= critical) return HealthStatus.CRITICAL;
    if (value >= warn) return HealthStatus.WARNING;
    return HealthStatus.HEALTHY;
  }
}

export default { HealthChecker, HealthStatus };
