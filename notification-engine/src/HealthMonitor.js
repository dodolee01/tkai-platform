/**
 * @file Health monitoring: provider availability, queue size,
 * delivery/failure rates, average delivery time, and retry count —
 * with configurable warning/critical thresholds.
 * @module notification-engine/HealthMonitor
 */

export class HealthMonitor {
  /**
   * @param {Object} deps
   * @param {import('./Metrics.js').Metrics} deps.metrics
   * @param {import('./NotificationQueue.js').NotificationQueue} deps.queue
   * @param {import('./DeliveryTracker.js').DeliveryTracker} deps.deliveryTracker
   * @param {import('./Logger.js').Logger} [deps.logger]
   * @param {object} config - `config.health` section.
   */
  constructor({ metrics, queue, deliveryTracker, logger = null }, config) {
    /** @private */ this._metrics = metrics;
    /** @private */ this._queue = queue;
    /** @private */ this._deliveryTracker = deliveryTracker;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
    /** @private @type {Map<string, {available: boolean, lastError: string|null, lastCheckedAt: number}>} */
    this._providerAvailability = new Map();
  }

  /**
   * Record whether a provider's most recent delivery attempt
   * succeeded or failed — used to derive availability.
   * @param {string} channel
   * @param {boolean} available
   * @param {string|null} [error=null]
   * @returns {void}
   */
  reportProviderStatus(channel, available, error = null) {
    this._providerAvailability.set(channel, { available, lastError: error, lastCheckedAt: Date.now() });
  }

  /**
   * @returns {Object.<string, {available: boolean, lastError: string|null, lastCheckedAt: number}>}
   */
  getProviderAvailability() {
    return Object.fromEntries(this._providerAvailability);
  }

  /**
   * Run a full health evaluation.
   * @returns {{status: 'healthy'|'warning'|'critical', issues: string[]}}
   */
  check() {
    const issues = [];
    let severity = 'healthy';

    const queueSizes = this._queue.getSizes();
    const totalQueued = queueSizes.main + queueSizes.delayed + queueSizes.retry;
    if (totalQueued >= this._config.queueSizeCriticalThreshold) {
      issues.push(`queue size critical: ${totalQueued} >= ${this._config.queueSizeCriticalThreshold}`);
      severity = 'critical';
    } else if (totalQueued >= this._config.queueSizeWarnThreshold) {
      issues.push(`queue size warning: ${totalQueued} >= ${this._config.queueSizeWarnThreshold}`);
      if (severity !== 'critical') severity = 'warning';
    }

    const failureRate = this._metrics.getFailureRate();
    if (failureRate >= this._config.failureRateCriticalThreshold) {
      issues.push(`failure rate critical: ${(failureRate * 100).toFixed(1)}%`);
      severity = 'critical';
    } else if (failureRate >= this._config.failureRateWarnThreshold) {
      issues.push(`failure rate warning: ${(failureRate * 100).toFixed(1)}%`);
      if (severity !== 'critical') severity = 'warning';
    }

    for (const [channel, status] of this._providerAvailability) {
      if (!status.available) {
        issues.push(`provider unavailable: ${channel} (${status.lastError ?? 'unknown error'})`);
        if (severity !== 'critical') severity = 'warning';
      }
    }

    if (severity === 'critical') this._logger?.critical?.('Notification engine health: critical', { issues });
    else if (severity === 'warning') this._logger?.warn?.('Notification engine health: warning', { issues });

    return { status: severity, issues };
  }

  /**
   * @returns {object} A full health report: status, queue sizes, delivery stats, provider availability.
   */
  getReport() {
    const { status, issues } = this.check();
    return {
      status,
      issues,
      queueSize: this._queue.getSizes(),
      deliveryStats: this._deliveryTracker.computeStats(),
      providerAvailability: this.getProviderAvailability(),
      retryCount: this._metrics.getRetryCount(),
      averageDeliveryTimeMs: this._metrics.getAverageDeliveryTimeMs(),
    };
  }
}

export default HealthMonitor;
