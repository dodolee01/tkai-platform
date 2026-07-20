/**
 * @file Runtime metrics: notifications/minute, success/failure rate,
 * average delivery time, queue length, retry count, and per-provider
 * performance.
 * @module notification-engine/Metrics
 */

export class Metrics {
  /**
   * @param {object} config - `config.metrics` section.
   */
  constructor(config) {
    /** @private */ this._sampleWindowMs = config.sampleWindowMs;
    /** @private @type {number[]} */ this._sentTimestamps = [];
    /** @private */ this._successCount = 0;
    /** @private */ this._failureCount = 0;
    /** @private */ this._retryCount = 0;
    /** @private @type {number[]} */ this._deliveryTimes = [];
    /** @private @type {Map<string, {sent: number, success: number, failure: number, totalLatencyMs: number}>} */
    this._providerStats = new Map();
  }

  /** @returns {void} */
  recordSent() {
    this._sentTimestamps.push(Date.now());
  }

  /** @returns {void} */
  recordRetry() {
    this._retryCount += 1;
  }

  /**
   * @param {string} channel
   * @param {boolean} success
   * @param {number} latencyMs
   * @returns {void}
   */
  recordDelivery(channel, success, latencyMs) {
    if (success) {
      this._successCount += 1;
      this._deliveryTimes.push(latencyMs);
      if (this._deliveryTimes.length > 1000) this._deliveryTimes.shift();
    } else {
      this._failureCount += 1;
    }

    if (!this._providerStats.has(channel)) {
      this._providerStats.set(channel, { sent: 0, success: 0, failure: 0, totalLatencyMs: 0 });
    }
    const stats = this._providerStats.get(channel);
    stats.sent += 1;
    if (success) {
      stats.success += 1;
      stats.totalLatencyMs += latencyMs;
    } else {
      stats.failure += 1;
    }
  }

  /**
   * @param {number} [now=Date.now()]
   * @returns {number}
   */
  getNotificationsPerMinute(now = Date.now()) {
    const cutoff = now - 60000;
    this._sentTimestamps = this._sentTimestamps.filter((t) => t >= cutoff);
    return this._sentTimestamps.length;
  }

  /**
   * @returns {number}
   */
  getSuccessRate() {
    const total = this._successCount + this._failureCount;
    return total === 0 ? 0 : this._successCount / total;
  }

  /**
   * @returns {number}
   */
  getFailureRate() {
    const total = this._successCount + this._failureCount;
    return total === 0 ? 0 : this._failureCount / total;
  }

  /**
   * @returns {number}
   */
  getAverageDeliveryTimeMs() {
    if (this._deliveryTimes.length === 0) return 0;
    return this._deliveryTimes.reduce((a, b) => a + b, 0) / this._deliveryTimes.length;
  }

  /**
   * @returns {number}
   */
  getRetryCount() {
    return this._retryCount;
  }

  /**
   * @returns {Object.<string, {sent: number, success: number, failure: number, successRate: number, avgLatencyMs: number}>}
   */
  getProviderPerformance() {
    const result = {};
    for (const [channel, stats] of this._providerStats) {
      result[channel] = {
        sent: stats.sent,
        success: stats.success,
        failure: stats.failure,
        successRate: stats.sent === 0 ? 0 : stats.success / stats.sent,
        avgLatencyMs: stats.success === 0 ? 0 : stats.totalLatencyMs / stats.success,
      };
    }
    return result;
  }

  /**
   * @param {number} currentQueueLength
   * @returns {object}
   */
  getSnapshot(currentQueueLength) {
    return {
      notificationsPerMinute: this.getNotificationsPerMinute(),
      successRate: this.getSuccessRate(),
      failureRate: this.getFailureRate(),
      avgDeliveryTimeMs: this.getAverageDeliveryTimeMs(),
      queueLength: currentQueueLength,
      retryCount: this.getRetryCount(),
      providerPerformance: this.getProviderPerformance(),
    };
  }
}

export default Metrics;
