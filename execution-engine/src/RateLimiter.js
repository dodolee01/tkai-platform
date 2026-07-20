/**
 * @file Token-bucket rate limiter for exchange API request weight.
 * @module execution-engine/RateLimiter
 */

/**
 * Sliding-window token bucket. Callers `acquire()` before every
 * outbound exchange request; the promise resolves immediately if
 * capacity is available, or after enough time has elapsed for a slot
 * to free up.
 */
export class RateLimiter {
  /**
   * @param {object} config - `config.rateLimiter` section.
   * @param {() => number} [clock=Date.now] - Injectable clock for deterministic testing.
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._maxRequests = config.maxRequests;
    /** @private */ this._windowMs = config.windowMs;
    /** @private */ this._clock = clock;
    /** @private @type {number[]} */ this._timestamps = [];
  }

  /**
   * @returns {void}
   * @private
   */
  _prune() {
    const cutoff = this._clock() - this._windowMs;
    while (this._timestamps.length > 0 && this._timestamps[0] < cutoff) {
      this._timestamps.shift();
    }
  }

  /**
   * @returns {number} Requests currently counted within the active window.
   */
  currentLoad() {
    this._prune();
    return this._timestamps.length;
  }

  /**
   * Resolve once a request slot is available, recording the request.
   * @returns {Promise<void>}
   */
  async acquire() {
    this._prune();
    if (this._timestamps.length < this._maxRequests) {
      this._timestamps.push(this._clock());
      return;
    }
    const oldestInWindow = this._timestamps[0];
    const waitMs = Math.max(0, oldestInWindow + this._windowMs - this._clock());
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.acquire();
  }

  /**
   * Non-blocking check: would `acquire()` resolve immediately right now?
   * @returns {boolean}
   */
  hasCapacity() {
    this._prune();
    return this._timestamps.length < this._maxRequests;
  }

  /**
   * Clear all tracked request timestamps.
   * @returns {void}
   */
  reset() {
    this._timestamps = [];
  }
}

export default RateLimiter;
