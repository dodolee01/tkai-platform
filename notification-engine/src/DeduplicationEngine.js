/**
 * @file Prevents duplicate notifications within a time window and
 * merges repeated events into a single "occurred N times" record.
 * @module notification-engine/DeduplicationEngine
 */

import { createHash } from 'node:crypto';

/**
 * Deterministically hash the identity-relevant fields of a
 * notification into a dedupe key. Two notifications with the same
 * type/userId/symbol (or whatever `data` fields are economically
 * identical) within the dedup window are treated as duplicates.
 * @param {import('./types.js').NotificationRequest} request
 * @returns {string}
 */
export function computeDedupeKey(request) {
  const material = JSON.stringify({
    type: request.type,
    userId: request.userId ?? null,
    symbol: request.data?.symbol ?? null,
    reason: request.data?.reason ?? null,
  });
  return createHash('sha256').update(material).digest('hex');
}

/**
 * @typedef {Object} DedupeEntry
 * @property {number} firstSeenAt
 * @property {number} lastSeenAt
 * @property {number} count
 * @property {number} expiresAt
 */

export class DeduplicationEngine {
  /**
   * @param {object} config - `config.deduplication` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._windowMs = config.windowMs;
    /** @private */ this._maxTrackedKeys = config.maxTrackedKeys;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, DedupeEntry>} */
    this._entries = new Map();
  }

  /** @returns {void} @private */
  _prune() {
    const now = this._clock();
    for (const [key, entry] of this._entries) {
      if (entry.expiresAt <= now) this._entries.delete(key);
    }
    if (this._entries.size > this._maxTrackedKeys) {
      const sorted = Array.from(this._entries.entries()).sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
      const overflow = this._entries.size - this._maxTrackedKeys;
      for (let i = 0; i < overflow; i++) this._entries.delete(sorted[i][0]);
    }
  }

  /**
   * Check a dedupe key. If it's new (or expired), records it and
   * returns `{isDuplicate: false, occurrenceCount: 1}`. If it's a
   * duplicate within the window, increments its count and returns
   * `{isDuplicate: true, occurrenceCount: N}` — the caller should
   * suppress delivery but may use `occurrenceCount` to eventually
   * emit a summarized "occurred N times" notification.
   * @param {string} key
   * @returns {{isDuplicate: boolean, occurrenceCount: number}}
   */
  check(key) {
    this._prune();
    const now = this._clock();
    const existing = this._entries.get(key);

    if (existing && existing.expiresAt > now) {
      existing.count += 1;
      existing.lastSeenAt = now;
      existing.expiresAt = now + this._windowMs;
      return { isDuplicate: true, occurrenceCount: existing.count };
    }

    this._entries.set(key, { firstSeenAt: now, lastSeenAt: now, count: 1, expiresAt: now + this._windowMs });
    this._prune();
    return { isDuplicate: false, occurrenceCount: 1 };
  }

  /**
   * @param {string} key
   * @returns {DedupeEntry|undefined}
   */
  getEntry(key) {
    return this._entries.get(key);
  }

  /** @returns {void} */
  reset() {
    this._entries.clear();
  }
}

export default { DeduplicationEngine, computeDedupeKey };
