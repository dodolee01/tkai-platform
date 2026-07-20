/**
 * @file Delivery state-machine tracking: QUEUED -> SENT -> DELIVERED/
 * FAILED -> RETRIED -> EXPIRED, per (notification, channel) pair.
 * @module notification-engine/DeliveryTracker
 */

/**
 * @enum {string}
 */
export const DeliveryStatus = Object.freeze({
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETRIED: 'RETRIED',
  EXPIRED: 'EXPIRED',
});

const VALID_TRANSITIONS = Object.freeze({
  [DeliveryStatus.QUEUED]: [DeliveryStatus.SENT, DeliveryStatus.FAILED, DeliveryStatus.EXPIRED],
  [DeliveryStatus.SENT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.FAILED]: [DeliveryStatus.RETRIED, DeliveryStatus.EXPIRED],
  [DeliveryStatus.RETRIED]: [DeliveryStatus.SENT, DeliveryStatus.FAILED, DeliveryStatus.EXPIRED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.EXPIRED]: [],
});

/**
 * @param {string} notificationId
 * @param {string} channel
 * @returns {string}
 * @private
 */
function deliveryKey(notificationId, channel) {
  return `${notificationId}::${channel}`;
}

/**
 * @typedef {Object} DeliveryRecord
 * @property {string} notificationId
 * @property {string} channel
 * @property {string} status
 * @property {number} attempts
 * @property {string|null} providerMessageId
 * @property {string|null} lastError
 * @property {number} queuedAt
 * @property {number|null} sentAt
 * @property {number|null} deliveredAt
 * @property {number} updatedAt
 */

export class DeliveryTracker {
  constructor() {
    /** @private @type {Map<string, DeliveryRecord>} */
    this._records = new Map();
  }

  /**
   * @param {string} notificationId
   * @param {string} channel
   * @returns {DeliveryRecord}
   */
  trackQueued(notificationId, channel) {
    const now = Date.now();
    const record = {
      notificationId, channel, status: DeliveryStatus.QUEUED, attempts: 0,
      providerMessageId: null, lastError: null, queuedAt: now, sentAt: null, deliveredAt: null, updatedAt: now,
    };
    this._records.set(deliveryKey(notificationId, channel), record);
    return record;
  }

  /**
   * @param {string} notificationId
   * @param {string} channel
   * @param {string} status
   * @param {Object} [details]
   * @returns {DeliveryRecord}
   */
  updateStatus(notificationId, channel, status, details = {}) {
    const key = deliveryKey(notificationId, channel);
    const record = this._records.get(key);
    if (!record) throw new Error(`DeliveryTracker: no delivery record for "${key}"`);

    const allowedNext = VALID_TRANSITIONS[record.status] || [];
    if (!allowedNext.includes(status)) {
      throw new Error(`DeliveryTracker: invalid transition "${record.status}" -> "${status}" for "${key}"`);
    }

    record.status = status;
    record.updatedAt = Date.now();
    if (status === DeliveryStatus.SENT) {
      record.attempts += 1;
      record.sentAt = record.updatedAt;
    }
    if (status === DeliveryStatus.DELIVERED) {
      record.deliveredAt = record.updatedAt;
      if (details.providerMessageId !== undefined) record.providerMessageId = details.providerMessageId;
    }
    if (status === DeliveryStatus.FAILED && details.error !== undefined) {
      record.lastError = details.error;
    }

    return record;
  }

  /**
   * @param {string} notificationId
   * @param {string} channel
   * @returns {DeliveryRecord|undefined}
   */
  get(notificationId, channel) {
    return this._records.get(deliveryKey(notificationId, channel));
  }

  /**
   * @param {string} notificationId
   * @returns {DeliveryRecord[]}
   */
  getByNotification(notificationId) {
    return Array.from(this._records.values()).filter((r) => r.notificationId === notificationId);
  }

  /**
   * @returns {DeliveryRecord[]}
   */
  getAll() {
    return Array.from(this._records.values());
  }

  /**
   * @param {number} [windowMs] - If supplied, only consider records updated within this window.
   * @returns {{total: number, delivered: number, failed: number, deliveryRate: number, failureRate: number, avgDeliveryTimeMs: number}}
   */
  computeStats(windowMs) {
    const now = Date.now();
    const records = this.getAll().filter((r) => windowMs === undefined || now - r.updatedAt <= windowMs);
    const total = records.length;
    const delivered = records.filter((r) => r.status === DeliveryStatus.DELIVERED);
    const failed = records.filter((r) => r.status === DeliveryStatus.FAILED || r.status === DeliveryStatus.EXPIRED);

    const deliveryTimes = delivered.filter((r) => r.sentAt !== null && r.deliveredAt !== null).map((r) => r.deliveredAt - r.sentAt);
    const avgDeliveryTimeMs = deliveryTimes.length === 0 ? 0 : deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;

    return {
      total,
      delivered: delivered.length,
      failed: failed.length,
      deliveryRate: total === 0 ? 0 : delivered.length / total,
      failureRate: total === 0 ? 0 : failed.length / total,
      avgDeliveryTimeMs,
    };
  }
}

export default { DeliveryTracker, DeliveryStatus };
