/**
 * @file Exponential-backoff retry wrapper for async exchange
 * operations, retrying only errors classified as retryable.
 * @module execution-engine/RetryManager
 */

import { classifyError } from './ErrorHandler.js';

/**
 * @typedef {Object} RetryResult
 * @property {boolean} success
 * @property {*} [result]
 * @property {import('./ErrorHandler.js').ClassifiedError} [error]
 * @property {number} attempts
 */

/**
 * Retry an async operation with exponential backoff, stopping
 * immediately on a non-retryable error (e.g. a rejected order due to
 * insufficient margin should never be blindly resubmitted).
 */
export class RetryManager {
  /**
   * @param {object} config - `config.retry` section.
   * @param {(ms:number) => Promise<void>} [delayFn] - Injectable delay function for deterministic testing.
   */
  constructor(config, delayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
    /** @private */ this._maxAttempts = config.maxAttempts;
    /** @private */ this._baseDelayMs = config.baseDelayMs;
    /** @private */ this._maxDelayMs = config.maxDelayMs;
    /** @private */ this._multiplier = config.multiplier;
    /** @private */ this._delayFn = delayFn;
  }

  /**
   * @param {number} attempt - 0-indexed attempt number.
   * @returns {number}
   * @private
   */
  _delayForAttempt(attempt) {
    return Math.min(this._baseDelayMs * this._multiplier ** attempt, this._maxDelayMs);
  }

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<RetryResult>}
   */
  async execute(operation) {
    let lastClassifiedError = null;

    for (let attempt = 0; attempt < this._maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt + 1 };
      } catch (err) {
        const classified = classifyError(err);
        lastClassifiedError = classified;

        if (!classified.retryable || attempt === this._maxAttempts - 1) {
          return { success: false, error: classified, attempts: attempt + 1 };
        }
        await this._delayFn(this._delayForAttempt(attempt));
      }
    }

    // Unreachable in practice (loop always returns), but keeps the
    // function's return type total for static analysis.
    return { success: false, error: lastClassifiedError, attempts: this._maxAttempts };
  }
}

export default RetryManager;
