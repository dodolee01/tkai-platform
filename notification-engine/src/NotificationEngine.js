/**
 * @file The notification engine orchestrator — wires the manager,
 * dispatcher, queue, and every provider together into a single
 * public API, and drives the async processing loop. This is the
 * module's sole integration point for every other engine (Modules
 * 1–8) and for direct application use.
 * @module notification-engine/NotificationEngine
 */

import { createConfig } from './Config.js';
import { Logger } from './Logger.js';
import { AlertRules } from './AlertRules.js';
import { AlertTemplates } from './AlertTemplates.js';
import { DeduplicationEngine } from './DeduplicationEngine.js';
import { RateLimiter } from './RateLimiter.js';
import { RetryManager } from './RetryManager.js';
import { NotificationQueue } from './NotificationQueue.js';
import { DeliveryTracker } from './DeliveryTracker.js';
import { NotificationHistory } from './NotificationHistory.js';
import { Metrics } from './Metrics.js';
import { HealthMonitor } from './HealthMonitor.js';
import { NotificationManager } from './NotificationManager.js';
import { NotificationDispatcher } from './NotificationDispatcher.js';
import { InMemoryNotificationRepository } from './NotificationRepository.js';

export class NotificationEngine {
  /**
   * @param {Object} [deps]
   * @param {Object.<string, import('./types.js').NotificationProvider>} [deps.providers={}] - channel name -> provider instance (e.g. `{ telegram: new TelegramProvider(...) }`).
   * @param {import('./NotificationRepository.js').NotificationRepository} [deps.repository] - Defaults to an in-memory repository.
   * @param {import('./Logger.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ providers = {}, repository = new InMemoryNotificationRepository(), logger } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._repository = repository;
    /** @type {Logger} */
    this.logger = logger ?? new Logger(this.config.logging);
    /** @private */ this._providers = providers;

    /** @type {AlertRules} */
    this.alertRules = new AlertRules();
    /** @type {AlertTemplates} */
    this.alertTemplates = new AlertTemplates();
    /** @type {DeduplicationEngine} */
    this.deduplicationEngine = new DeduplicationEngine(this.config.deduplication);
    /** @type {RateLimiter} */
    this.rateLimiter = new RateLimiter(this.config.rateLimiter);
    /** @type {RetryManager} */
    this.retryManager = new RetryManager(this.config.retry);
    /** @type {NotificationQueue} */
    this.queue = new NotificationQueue();
    /** @type {DeliveryTracker} */
    this.deliveryTracker = new DeliveryTracker();
    /** @type {NotificationHistory} */
    this.history = new NotificationHistory(this.config.history);
    /** @type {Metrics} */
    this.metrics = new Metrics(this.config.metrics);
    /** @type {HealthMonitor} */
    this.healthMonitor = new HealthMonitor(
      { metrics: this.metrics, queue: this.queue, deliveryTracker: this.deliveryTracker, logger: this.logger },
      this.config.health
    );

    /** @type {NotificationManager} */
    this.manager = new NotificationManager(
      {
        alertRules: this.alertRules,
        alertTemplates: this.alertTemplates,
        deduplicationEngine: this.deduplicationEngine,
        rateLimiter: this.rateLimiter,
        queue: this.queue,
        logger: this.logger,
      },
      this.config
    );
    /** @type {NotificationDispatcher} */
    this.dispatcher = new NotificationDispatcher({
      providers: this._providers,
      deliveryTracker: this.deliveryTracker,
      retryManager: this.retryManager,
      queue: this.queue,
      metrics: this.metrics,
      healthMonitor: this.healthMonitor,
      logger: this.logger,
    });

    /** @private */ this._processingTimer = null;
    /** @private */ this._unsubscribers = [];
  }

  /**
   * Submit a notification request. Resolves priority/channels,
   * renders the template, applies dedup/rate-limit checks, and
   * enqueues it for asynchronous delivery by the processing loop
   * (see {@link NotificationEngine#start}).
   * @param {import('./types.js').NotificationRequest} request
   * @returns {{queued: boolean, notification: import('./types.js').Notification|null, reason: string|null}}
   */
  notify(request) {
    return this.manager.submit(request);
  }

  /**
   * Subscribe to an event-emitting engine (any of Modules 1–8's
   * event publishers, duck-typed — only `.on(eventName, handler)` is
   * required) and map its events to notification requests.
   * @param {{on: (eventName: string, handler: Function) => void}} emitter
   * @param {Object.<string, (payload: any) => import('./types.js').NotificationRequest|null>} eventMap - eventName -> a function turning the event payload into a NotificationRequest (or null to skip).
   * @returns {void}
   */
  subscribeToEngine(emitter, eventMap) {
    for (const [eventName, mapper] of Object.entries(eventMap)) {
      const handler = (payload) => {
        try {
          const request = mapper(payload);
          if (request) this.notify(request);
        } catch (err) {
          this.logger.error(`Event mapper for "${eventName}" threw`, { error: err.message });
        }
      };
      emitter.on(eventName, handler);
      this._unsubscribers.push(() => emitter.off?.(eventName, handler));
    }
  }

  /**
   * Process a single item from the queue (dequeue -> dispatch ->
   * persist to history/repository). Exposed directly for
   * deterministic testing; {@link NotificationEngine#start} calls
   * this in a loop.
   * @returns {Promise<boolean>} Whether an item was processed.
   */
  async processNext() {
    this.queue.processDelayed();
    this.queue.processRetries();

    const notification = this.queue.dequeue();
    if (!notification) return false;

    await this.dispatcher.dispatch(notification);
    this.history.add(notification);
    await this._repository.save(notification);
    for (const record of this.deliveryTracker.getByNotification(notification.id)) {
      await this._repository.saveDeliveryRecord(record);
    }
    return true;
  }

  /**
   * Start the asynchronous processing loop, draining the queue on
   * the configured interval.
   * @returns {void}
   */
  start() {
    if (this._processingTimer) return;
    const tick = async () => {
      let processed = true;
      while (processed) {
        processed = await this.processNext();
      }
    };
    this._processingTimer = setInterval(tick, this.config.queue.delayedCheckIntervalMs);
    this._processingTimer.unref?.();
    tick(); // drain immediately on start rather than waiting for the first interval
  }

  /**
   * Stop the processing loop.
   * @returns {void}
   */
  stop() {
    if (this._processingTimer) {
      clearInterval(this._processingTimer);
      this._processingTimer = null;
    }
  }

  /**
   * Gracefully shut down: stop processing and close the logger.
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.stop();
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    await this.logger.close();
  }

  /**
   * @returns {object}
   */
  getMetricsSnapshot() {
    return this.metrics.getSnapshot(this.queue.mainQueueSize);
  }

  /**
   * @returns {object}
   */
  getHealthReport() {
    return this.healthMonitor.getReport();
  }
}

export default NotificationEngine;
