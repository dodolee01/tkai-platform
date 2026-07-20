/**
 * @file Asynchronous notification queueing: a FIFO-within-priority
 * main queue, a delayed queue (time-gated release), a retry queue,
 * and a terminal dead-letter queue.
 * @module notification-engine/NotificationQueue
 */

import { PRIORITY_ORDER } from './NotificationPriority.js';

export class NotificationQueue {
  constructor() {
    /** @private @type {Map<string, import('./types.js').Notification[]>} priority -> FIFO array */
    this._mainQueue = new Map(PRIORITY_ORDER.map((p) => [p, []]));
    /** @private @type {{notification: import('./types.js').Notification, releaseAt: number}[]} */
    this._delayedQueue = [];
    /** @private @type {{notification: import('./types.js').Notification, releaseAt: number, attempt: number}[]} */
    this._retryQueue = [];
    /** @private @type {{notification: import('./types.js').Notification, reason: string, failedAt: number}[]} */
    this._deadLetterQueue = [];
  }

  /**
   * Enqueue a notification for immediate processing, ordered by
   * priority (FIFO within the same priority level).
   * @param {import('./types.js').Notification} notification
   * @returns {void}
   */
  enqueue(notification) {
    const bucket = this._mainQueue.get(notification.priority);
    if (!bucket) throw new Error(`NotificationQueue: unknown priority "${notification.priority}"`);
    bucket.push(notification);
  }

  /**
   * Dequeue the next notification to process: highest priority
   * first, FIFO within that priority.
   * @returns {import('./types.js').Notification|null}
   */
  dequeue() {
    for (const priority of PRIORITY_ORDER) {
      const bucket = this._mainQueue.get(priority);
      if (bucket.length > 0) return bucket.shift();
    }
    return null;
  }

  /**
   * @returns {number} Total items across all priority buckets of the main queue.
   */
  get mainQueueSize() {
    let total = 0;
    for (const bucket of this._mainQueue.values()) total += bucket.length;
    return total;
  }

  /**
   * Schedule a notification for delayed release.
   * @param {import('./types.js').Notification} notification
   * @param {number} delayMs
   * @param {number} [now=Date.now()]
   * @returns {void}
   */
  enqueueDelayed(notification, delayMs, now = Date.now()) {
    this._delayedQueue.push({ notification, releaseAt: now + delayMs });
  }

  /**
   * Move any delayed items whose release time has passed into the
   * main queue. Call periodically (driven by the engine's processing loop).
   * @param {number} [now=Date.now()]
   * @returns {number} Count of items released.
   */
  processDelayed(now = Date.now()) {
    const due = [];
    this._delayedQueue = this._delayedQueue.filter((item) => {
      if (item.releaseAt <= now) {
        due.push(item.notification);
        return false;
      }
      return true;
    });
    for (const notification of due) this.enqueue(notification);
    return due.length;
  }

  /**
   * @returns {number}
   */
  get delayedQueueSize() {
    return this._delayedQueue.length;
  }

  /**
   * Schedule a failed notification for a retry attempt after a delay.
   * @param {import('./types.js').Notification} notification
   * @param {number} delayMs
   * @param {number} attempt
   * @param {number} [now=Date.now()]
   * @returns {void}
   */
  enqueueRetry(notification, delayMs, attempt, now = Date.now()) {
    this._retryQueue.push({ notification, releaseAt: now + delayMs, attempt });
  }

  /**
   * Move any retry items whose delay has elapsed back into the main queue.
   * @param {number} [now=Date.now()]
   * @returns {number} Count of items released.
   */
  processRetries(now = Date.now()) {
    const due = [];
    this._retryQueue = this._retryQueue.filter((item) => {
      if (item.releaseAt <= now) {
        due.push(item.notification);
        return false;
      }
      return true;
    });
    for (const notification of due) this.enqueue(notification);
    return due.length;
  }

  /**
   * @returns {number}
   */
  get retryQueueSize() {
    return this._retryQueue.length;
  }

  /**
   * Move a notification to the dead-letter queue — a terminal state
   * for notifications that exhausted all retry attempts.
   * @param {import('./types.js').Notification} notification
   * @param {string} reason
   * @returns {void}
   */
  enqueueDeadLetter(notification, reason) {
    this._deadLetterQueue.push({ notification, reason, failedAt: Date.now() });
  }

  /**
   * @returns {{notification: import('./types.js').Notification, reason: string, failedAt: number}[]}
   */
  getDeadLetterQueue() {
    return this._deadLetterQueue.slice();
  }

  /**
   * @returns {number}
   */
  get deadLetterQueueSize() {
    return this._deadLetterQueue.length;
  }

  /**
   * @returns {{main: number, delayed: number, retry: number, deadLetter: number}}
   */
  getSizes() {
    return {
      main: this.mainQueueSize,
      delayed: this.delayedQueueSize,
      retry: this.retryQueueSize,
      deadLetter: this.deadLetterQueueSize,
    };
  }
}

export default NotificationQueue;
