/**
 * @file Multi-dimensional rate limiting: per-user, per-channel, and
 * per-notification-type, each with per-minute/hour/day sliding windows.
 * @module notification-engine/RateLimiter
 */

const WINDOW_MS = Object.freeze({ minute: 60 * 1000, hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 });

export class RateLimiter {
  /**
   * @param {object} config - `config.rateLimiter` section (`perMinute`, `perHour`, `perDay`).
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, number[]>} */
    this._timestamps = new Map();
  }

  /**
   * @param {string} dimension - e.g. 'user', 'channel', 'type'.
   * @param {string} key - e.g. a userId, channel name, or notification type.
   * @returns {string}
   * @private
   */
  _bucketKey(dimension, key) {
    return `${dimension}::${key}`;
  }

  /** @param {string} bucketKey @returns {number[]} @private */
  _getTimestamps(bucketKey) {
    if (!this._timestamps.has(bucketKey)) this._timestamps.set(bucketKey, []);
    return this._timestamps.get(bucketKey);
  }

  /**
   * Non-destructively count timestamps within a window. Timestamps
   * are always appended in increasing order, so a linear scan from
   * the end is sufficient and no earlier scan can leave the array in
   * a state that corrupts a later, wider-window count within the
   * same `check()` call.
   * @param {number[]} timestamps
   * @param {number} windowMs
   * @param {number} now
   * @returns {number}
   * @private
   */
  _countInWindow(timestamps, windowMs, now) {
    const cutoff = now - windowMs;
    let count = 0;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] >= cutoff) count++;
      else break;
    }
    return count;
  }

  /**
   * Drop timestamps older than the widest (day) window — a safe
   * upper retention bound shared by every narrower window check.
   * @param {number[]} timestamps
   * @param {number} now
   * @returns {void}
   * @private
   */
  _pruneToRetentionHorizon(timestamps, now) {
    const cutoff = now - WINDOW_MS.day;
    let firstValidIndex = 0;
    while (firstValidIndex < timestamps.length && timestamps[firstValidIndex] < cutoff) firstValidIndex++;
    if (firstValidIndex > 0) timestamps.splice(0, firstValidIndex);
  }

  /**
   * Check whether a dimension/key is currently within all three
   * (minute/hour/day) limits, WITHOUT recording an attempt.
   * @param {string} dimension
   * @param {string} key
   * @returns {{allowed: boolean, exceeded: string[]}}
   */
  check(dimension, key) {
    const bucketKey = this._bucketKey(dimension, key);
    const timestamps = this._getTimestamps(bucketKey);
    const now = this._clock();

    this._pruneToRetentionHorizon(timestamps, now);

    const exceeded = [];
    if (this._countInWindow(timestamps, WINDOW_MS.minute, now) >= this._config.perMinute) exceeded.push('perMinute');
    if (this._countInWindow(timestamps, WINDOW_MS.hour, now) >= this._config.perHour) exceeded.push('perHour');
    if (this._countInWindow(timestamps, WINDOW_MS.day, now) >= this._config.perDay) exceeded.push('perDay');

    return { allowed: exceeded.length === 0, exceeded };
  }

  /**
   * Record an attempt for a dimension/key (call after a successful
   * `check()` and once delivery is actually being attempted).
   * @param {string} dimension
   * @param {string} key
   * @returns {void}
   */
  record(dimension, key) {
    const bucketKey = this._bucketKey(dimension, key);
    this._getTimestamps(bucketKey).push(this._clock());
  }

  /**
   * Check every relevant dimension for a notification at once
   * (user, channel, type) and record the attempt if all pass.
   * @param {Object} identifiers
   * @param {string} [identifiers.userId]
   * @param {string} identifiers.channel
   * @param {string} identifiers.type
   * @returns {{allowed: boolean, exceeded: string[]}}
   */
  checkAndRecord({ userId, channel, type }) {
    const checks = [];
    if (userId) checks.push({ dimension: 'user', key: userId, result: this.check('user', userId) });
    checks.push({ dimension: 'channel', key: channel, result: this.check('channel', channel) });
    checks.push({ dimension: 'type', key: type, result: this.check('type', type) });

    const failing = checks.filter((c) => !c.result.allowed);
    if (failing.length > 0) {
      return { allowed: false, exceeded: failing.map((c) => `${c.dimension}:${c.result.exceeded.join(',')}`) };
    }

    for (const c of checks) this.record(c.dimension, c.key);
    return { allowed: true, exceeded: [] };
  }

  /** @returns {void} */
  reset() {
    this._timestamps.clear();
  }
}

export default RateLimiter;
