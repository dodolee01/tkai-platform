/**
 * @file Mid-level manager: turns a raw {@link NotificationRequest}
 * into a fully-resolved, queueable {@link Notification} — resolving
 * priority (AlertRules), rendering the message (AlertTemplates),
 * checking deduplication and rate limits, and enqueueing it.
 * @module notification-engine/NotificationManager
 */

import { randomUUID } from 'node:crypto';
import { resolveChannels } from './NotificationPriority.js';
import { computeDedupeKey } from './DeduplicationEngine.js';

export class NotificationManager {
  /**
   * @param {Object} deps
   * @param {import('./AlertRules.js').AlertRules} deps.alertRules
   * @param {import('./AlertTemplates.js').AlertTemplates} deps.alertTemplates
   * @param {import('./DeduplicationEngine.js').DeduplicationEngine} deps.deduplicationEngine
   * @param {import('./RateLimiter.js').RateLimiter} deps.rateLimiter
   * @param {import('./NotificationQueue.js').NotificationQueue} deps.queue
   * @param {import('./Logger.js').Logger} [deps.logger]
   * @param {object} config - Full notification-engine config (uses `routing`).
   */
  constructor({ alertRules, alertTemplates, deduplicationEngine, rateLimiter, queue, logger = null }, config) {
    /** @private */ this._alertRules = alertRules;
    /** @private */ this._alertTemplates = alertTemplates;
    /** @private */ this._deduplicationEngine = deduplicationEngine;
    /** @private */ this._rateLimiter = rateLimiter;
    /** @private */ this._queue = queue;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
  }

  /**
   * Process a raw notification request: resolve priority/channels,
   * render the template, check dedup and rate limits, and enqueue if
   * everything passes.
   * @param {import('./types.js').NotificationRequest} request
   * @returns {{queued: boolean, notification: import('./types.js').Notification|null, reason: string|null}}
   */
  submit(request) {
    const priority = this._alertRules.resolvePriority(request);
    const channels = request.channels ?? resolveChannels(priority, this._config.routing);
    const { title, body } = this._alertTemplates.render(request.type, request.data);
    const dedupeKey = computeDedupeKey(request);

    const dedupeResult = this._deduplicationEngine.check(dedupeKey);
    if (dedupeResult.isDuplicate) {
      this._logger?.debug?.(`Suppressed duplicate notification (occurrence ${dedupeResult.occurrenceCount})`, { type: request.type, dedupeKey });
      return { queued: false, notification: null, reason: `duplicate (occurrence ${dedupeResult.occurrenceCount})` };
    }

    const notification = {
      id: randomUUID(),
      type: request.type,
      priority,
      userId: request.userId,
      title,
      body,
      data: request.data,
      channels,
      dedupeKey,
      createdAt: Date.now(),
    };

    for (const channel of channels) {
      const rateLimitResult = this._rateLimiter.checkAndRecord({ userId: request.userId, channel, type: request.type });
      if (!rateLimitResult.allowed) {
        this._logger?.warn?.(`Rate limit exceeded for channel "${channel}"`, { type: request.type, exceeded: rateLimitResult.exceeded });
        notification.channels = notification.channels.filter((c) => c !== channel);
      }
    }

    if (notification.channels.length === 0) {
      return { queued: false, notification, reason: 'all channels rate-limited' };
    }

    this._queue.enqueue(notification);
    return { queued: true, notification, reason: null };
  }
}

export default NotificationManager;
