/**
 * @file Dispatches a resolved notification to every one of its
 * target channels, wrapping each send in retry logic, updating
 * delivery tracking, and recording metrics/health signals.
 * @module notification-engine/NotificationDispatcher
 */

import { DeliveryStatus } from './DeliveryTracker.js';

export class NotificationDispatcher {
  /**
   * @param {Object} deps
   * @param {Object.<string, import('./types.js').NotificationProvider>} deps.providers - channel name -> provider instance.
   * @param {import('./DeliveryTracker.js').DeliveryTracker} deps.deliveryTracker
   * @param {import('./RetryManager.js').RetryManager} deps.retryManager
   * @param {import('./NotificationQueue.js').NotificationQueue} deps.queue
   * @param {import('./Metrics.js').Metrics} deps.metrics
   * @param {import('./HealthMonitor.js').HealthMonitor} [deps.healthMonitor]
   * @param {import('./Logger.js').Logger} [deps.logger]
   */
  constructor({ providers, deliveryTracker, retryManager, queue, metrics, healthMonitor = null, logger = null }) {
    /** @private */ this._providers = providers;
    /** @private */ this._deliveryTracker = deliveryTracker;
    /** @private */ this._retryManager = retryManager;
    /** @private */ this._queue = queue;
    /** @private */ this._metrics = metrics;
    /** @private */ this._healthMonitor = healthMonitor;
    /** @private */ this._logger = logger;
  }

  /**
   * Dispatch a notification to every channel in `notification.channels`.
   * Each channel's delivery is independent — a failure on one channel
   * never blocks delivery on another.
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult[]>}
   */
  async dispatch(notification) {
    const results = await Promise.all(
      notification.channels.map((channel) => this._dispatchToChannel(notification, channel))
    );
    return results;
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @param {string} channel
   * @returns {Promise<import('./types.js').DeliveryResult>}
   * @private
   */
  async _dispatchToChannel(notification, channel) {
    const provider = this._providers[channel];
    if (!provider) {
      this._logger?.warn?.(`No provider registered for channel "${channel}"`, { notificationId: notification.id });
      return { success: false, channel, providerMessageId: null, error: 'no provider registered', latencyMs: 0 };
    }

    this._deliveryTracker.trackQueued(notification.id, channel);

    const retryResult = await this._retryManager.execute(
      async () => {
        this._deliveryTracker.updateStatus(notification.id, channel, DeliveryStatus.SENT);
        this._metrics.recordSent();
        const result = await provider.send(notification);
        if (!result.success) throw new Error(result.error ?? 'delivery failed');
        return result;
      },
      (err, attempt) => {
        this._metrics.recordRetry();
        this._deliveryTracker.updateStatus(notification.id, channel, DeliveryStatus.FAILED, { error: err.message });
        this._logger?.warn?.(`Delivery attempt ${attempt + 1} failed for ${channel}`, { notificationId: notification.id, error: err.message });
        const record = this._deliveryTracker.get(notification.id, channel);
        if (this._retryManager.hasAttemptsRemaining(record.attempts)) {
          this._deliveryTracker.updateStatus(notification.id, channel, DeliveryStatus.RETRIED);
        }
      }
    );

    if (retryResult.success) {
      this._deliveryTracker.updateStatus(notification.id, channel, DeliveryStatus.DELIVERED, { providerMessageId: retryResult.result.providerMessageId });
      this._metrics.recordDelivery(channel, true, retryResult.result.latencyMs);
      this._healthMonitor?.reportProviderStatus(channel, true);
      return retryResult.result;
    }

    // Exhausted retries — final state depends on whether it's already FAILED (last attempt) or needs to move to EXPIRED.
    const record = this._deliveryTracker.get(notification.id, channel);
    if (record.status === DeliveryStatus.FAILED) {
      this._deliveryTracker.updateStatus(notification.id, channel, DeliveryStatus.EXPIRED);
    }
    this._metrics.recordDelivery(channel, false, 0);
    this._healthMonitor?.reportProviderStatus(channel, false, retryResult.error?.message ?? 'delivery failed');
    if (retryResult.deadLettered) {
      this._queue.enqueueDeadLetter(notification, `channel "${channel}" exhausted retries: ${retryResult.error?.message}`);
    }

    return { success: false, channel, providerMessageId: null, error: retryResult.error?.message ?? 'delivery failed', latencyMs: 0 };
  }
}

export default NotificationDispatcher;
