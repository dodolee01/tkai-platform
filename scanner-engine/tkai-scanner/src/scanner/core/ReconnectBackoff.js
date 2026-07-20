/**
 * @file Exponential backoff calculator with jitter, for websocket reconnects.
 * @module scanner/core/ReconnectBackoff
 */

/**
 * Exponential backoff with full jitter.
 * Pure calculator with no timers of its own — callers own the
 * `setTimeout`, which keeps this class trivially unit-testable.
 */
export class ReconnectBackoff {
  /**
   * @param {Object} [options]
   * @param {number} [options.initialDelayMs=1000] - Delay before the first retry.
   * @param {number} [options.maxDelayMs=60000] - Ceiling on the computed delay.
   * @param {number} [options.multiplier=2] - Growth factor per consecutive failure.
   * @param {number} [options.jitterRatio=0.2] - Fraction of the delay randomized (0..1).
   */
  constructor({ initialDelayMs = 1000, maxDelayMs = 60000, multiplier = 2, jitterRatio = 0.2 } = {}) {
    /** @type {number} */ this.initialDelayMs = initialDelayMs;
    /** @type {number} */ this.maxDelayMs = maxDelayMs;
    /** @type {number} */ this.multiplier = multiplier;
    /** @type {number} */ this.jitterRatio = jitterRatio;
    /** @private @type {number} */ this._attempt = 0;
  }

  /**
   * Compute the delay for the next reconnect attempt and increment
   * the internal attempt counter.
   * @returns {number} Delay in milliseconds.
   */
  next() {
    const baseDelay = Math.min(
      this.initialDelayMs * this.multiplier ** this._attempt,
      this.maxDelayMs
    );
    this._attempt += 1;

    const jitterSpan = baseDelay * this.jitterRatio;
    const jitter = (Math.random() * 2 - 1) * jitterSpan; // +/- jitterSpan
    const delay = Math.max(0, Math.round(baseDelay + jitter));
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Reset the attempt counter (call after a successful, stable connection).
   * @returns {void}
   */
  reset() {
    this._attempt = 0;
  }

  /**
   * @returns {number} The number of consecutive failed attempts so far.
   */
  get attempt() {
    return this._attempt;
  }
}

export default ReconnectBackoff;
