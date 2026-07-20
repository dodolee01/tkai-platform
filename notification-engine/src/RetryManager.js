/**
 * @file Configurable retry: exponential or linear backoff, maximum
 * retry count, and dead-letter handoff for exhausted notifications.
 * @module notification-engine/RetryManager
 */

export class RetryManager {
  /**
   * @param {object} config - `config.retry` section.
   * @param {(ms: number) => Promise<void>} [delayFn]
   */
  constructor(config, delayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
    /** @private */ this._config = config;
    /** @private */ this._delayFn = delayFn;
  }

  /**
   * @param {number} attempt - 0-indexed attempt number.
   * @returns {number} Delay in milliseconds before the next attempt.
   */
  computeDelay(attempt) {
    const { strategy, baseDelayMs, maxDelayMs, multiplier, incrementMs } = this._config;
    const raw = strategy === 'linear' ? baseDelayMs + incrementMs * attempt : baseDelayMs * multiplier ** attempt;
    return Math.min(raw, maxDelayMs);
  }

  /**
   * @param {number} attempts - Number of attempts already made.
   * @returns {boolean}
   */
  hasAttemptsRemaining(attempts) {
    return attempts < this._config.maxAttempts;
  }

  /**
   * Execute an operation with retry. Every failure is passed to
   * `onFailure` (for failure logging); if attempts are exhausted, the
   * final result signals `deadLettered: true` so the caller can hand
   * the notification off to the dead-letter queue.
   * @template T
   * @param {() => Promise<T>} operation
   * @param {(error: Error, attempt: number) => void} [onFailure]
   * @returns {Promise<{success: boolean, result?: T, error?: Error, attempts: number, deadLettered: boolean}>}
   */
  async execute(operation, onFailure) {
    let lastError = null;
    for (let attempt = 0; attempt < this._config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt + 1, deadLettered: false };
      } catch (err) {
        lastError = err;
        onFailure?.(err, attempt);
        if (!this.hasAttemptsRemaining(attempt + 1)) {
          return { success: false, error: lastError, attempts: attempt + 1, deadLettered: true };
        }
        await this._delayFn(this.computeDelay(attempt));
      }
    }
    return { success: false, error: lastError, attempts: this._config.maxAttempts, deadLettered: true };
  }
}

export default RetryManager;
