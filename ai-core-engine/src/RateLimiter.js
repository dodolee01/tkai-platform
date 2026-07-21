/**
 * @file Multi-dimensional rate limiting: per-user and per-provider,
 * each with per-minute/per-hour sliding windows.
 *
 * Implementation note: each dimension's timestamp array is pruned
 * ONCE per check, to the widest configured window, and then counted
 * non-destructively for every narrower window from that same
 * already-pruned array. An earlier module in this platform (the
 * Notification Engine's rate limiter) pruned the same array
 * destructively once per window size within a single check — the
 * tighter minute-window prune deleted timestamps the wider hour
 * window still needed, silently undercounting. This implementation
 * is written correctly from the start to avoid repeating that bug.
 * @module ai-core-engine/RateLimiter
 */

const WINDOW_MS = Object.freeze({ minute: 60 * 1000, hour: 60 * 60 * 1000 });

export class RateLimiter {
  /**
   * @param {object} config - `config.rateLimiter` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, number[]>} */
    this._timestamps = new Map();
  }

  /**
   * @param {string} dimension
   * @param {string} key
   * @returns {string}
   * @private
   */
  _bucketKey(dimension, key) {
    return `${dimension}::${key}`;
  }

  /**
   * @param {string} bucketKey
   * @returns {number[]}
   * @private
   */
  _getTimestamps(bucketKey) {
    if (!this._timestamps.has(bucketKey)) this._timestamps.set(bucketKey, []);
    return this._timestamps.get(bucketKey);
  }

  /**
   * Drop timestamps older than the widest (hour) window — a single
   * safe retention bound shared by every narrower window check.
   * @param {number[]} timestamps
   * @param {number} now
   * @returns {void}
   * @private
   */
  _pruneToRetentionHorizon(timestamps, now) {
    const cutoff = now - WINDOW_MS.hour;
    let firstValidIndex = 0;
    while (firstValidIndex < timestamps.length && timestamps[firstValidIndex] < cutoff) firstValidIndex++;
    if (firstValidIndex > 0) timestamps.splice(0, firstValidIndex);
  }

  /**
   * Non-destructively count timestamps within a window. Timestamps
   * are always appended in increasing order, so a linear scan from
   * the end is sufficient.
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
   * @param {string} dimension - 'user' | 'provider'.
   * @param {string} key
   * @param {{perMinute: number, perHour: number}} limits
   * @returns {{allowed: boolean, exceeded: string[]}}
   */
  check(dimension, key, limits) {
    const bucketKey = this._bucketKey(dimension, key);
    const timestamps = this._getTimestamps(bucketKey);
    const now = this._clock();

    this._pruneToRetentionHorizon(timestamps, now);

    const exceeded = [];
    if (this._countInWindow(timestamps, WINDOW_MS.minute, now) >= limits.perMinute) exceeded.push('perMinute');
    if (this._countInWindow(timestamps, WINDOW_MS.hour, now) >= limits.perHour) exceeded.push('perHour');

    return { allowed: exceeded.length === 0, exceeded };
  }

  /**
   * @param {string} dimension
   * @param {string} key
   * @returns {void}
   */
  record(dimension, key) {
    this._getTimestamps(this._bucketKey(dimension, key)).push(this._clock());
  }

  /**
   * Check both the user and provider dimensions for a request at
   * once, and record the attempt only if both pass.
   * @param {string|undefined} userId
   * @param {string} provider
   * @returns {{allowed: boolean, exceeded: string[]}}
   */
  checkAndRecord(userId, provider) {
    const checks = [];
    if (userId) {
      checks.push({ dimension: 'user', key: userId, result: this.check('user', userId, { perMinute: this._config.perUserPerMinute, perHour: this._config.perUserPerHour }) });
    }
    checks.push({ dimension: 'provider', key: provider, result: this.check('provider', provider, { perMinute: this._config.perProviderPerMinute, perHour: this._config.perProviderPerHour }) });

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
