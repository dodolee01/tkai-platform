/**
 * @file Idempotency / order-lock protection: prevents the same
 * execution plan (or client order id) from being submitted twice
 * within a TTL window, and provides a per-symbol lock so overlapping
 * execution requests can't race each other.
 * @module execution-engine/DuplicateProtection
 */

import { createHash } from 'node:crypto';

/**
 * Deterministically hash the economically-significant fields of an
 * execution plan into an idempotency key. Two calls with the same
 * symbol/side/size/leverage/stops within the TTL window are treated
 * as the same intent — even if some cosmetic field differs.
 * @param {import('./types.js').ApprovedExecutionPlan} plan
 * @returns {string}
 */
export function computeIdempotencyKey(plan) {
  const material = JSON.stringify({
    symbol: plan.symbol,
    side: plan.side,
    positionSize: plan.positionSize,
    leverage: plan.leverage,
    stopLoss: plan.stopLoss,
    takeProfit: plan.takeProfit,
  });
  return createHash('sha256').update(material).digest('hex');
}

/**
 * Tracks recently-submitted idempotency keys (TTL-bounded) and
 * per-symbol execution locks.
 */
export class DuplicateProtection {
  /**
   * @param {object} config - `config.duplicateProtection` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._ttlMs = config.idempotencyTtlMs;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, number>} key -> expiry timestamp */
    this._seenKeys = new Map();
    /** @private @type {Set<string>} */
    this._locks = new Set();
  }

  /**
   * @returns {void}
   * @private
   */
  _prune() {
    const now = this._clock();
    for (const [key, expiry] of this._seenKeys) {
      if (expiry <= now) this._seenKeys.delete(key);
    }
  }

  /**
   * Check whether an idempotency key was already submitted within the
   * TTL window, WITHOUT recording it. Use {@link DuplicateProtection#claim}
   * to atomically check-and-record.
   * @param {string} key
   * @returns {boolean}
   */
  isDuplicate(key) {
    this._prune();
    return this._seenKeys.has(key);
  }

  /**
   * Atomically check-and-claim an idempotency key: returns `false` if
   * it was already claimed within the TTL window (do not proceed), or
   * records it and returns `true` (safe to proceed).
   * @param {string} key
   * @returns {boolean}
   */
  claim(key) {
    this._prune();
    if (this._seenKeys.has(key)) return false;
    this._seenKeys.set(key, this._clock() + this._ttlMs);
    return true;
  }

  /**
   * Acquire an execution lock for a symbol. Returns `false` if the
   * symbol is already locked (another execution is in flight).
   * @param {string} symbol
   * @returns {boolean}
   */
  acquireLock(symbol) {
    if (this._locks.has(symbol)) return false;
    this._locks.add(symbol);
    return true;
  }

  /**
   * Release a previously-acquired symbol lock.
   * @param {string} symbol
   * @returns {void}
   */
  releaseLock(symbol) {
    this._locks.delete(symbol);
  }

  /**
   * @param {string} symbol
   * @returns {boolean}
   */
  isLocked(symbol) {
    return this._locks.has(symbol);
  }

  /**
   * Clear all tracked keys and locks.
   * @returns {void}
   */
  reset() {
    this._seenKeys.clear();
    this._locks.clear();
  }
}

export default { DuplicateProtection, computeIdempotencyKey };
