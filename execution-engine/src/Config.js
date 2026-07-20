/**
 * @file Central, fully-overridable configuration for the execution engine.
 * @module execution-engine/Config
 */

/**
 * @type {object}
 */
export const DEFAULT_CONFIG = Object.freeze({
  // SAFETY: real orders are only ever sent when this is explicitly set
  // to false. Every example and test in this module runs with dryRun
  // left at its default (true) unless the test is specifically about
  // exercising the "real order" code path against a fake adapter.
  dryRun: true,

  retry: Object.freeze({
    maxAttempts: 3,
    baseDelayMs: 250,
    maxDelayMs: 4000,
    multiplier: 2,
  }),
  rateLimiter: Object.freeze({
    maxRequests: 20,
    windowMs: 1000,
  }),
  queue: Object.freeze({
    maxConcurrentGlobal: 4, // max symbols being executed simultaneously across the whole engine
  }),
  duplicateProtection: Object.freeze({
    idempotencyTtlMs: 60000,
  }),
  orderTimeout: Object.freeze({
    placeOrderMs: 10000,
    cancelOrderMs: 5000,
  }),
  killSwitch: Object.freeze({
    autoEngageOnConsecutiveErrors: 5,
    autoEngageWindowMs: 30000,
  }),
  leverage: Object.freeze({
    minLeverage: 1,
    maxLeverageHardCap: 125, // absolute platform ceiling regardless of what an exchange allows for a symbol
  }),
  validation: Object.freeze({
    minNotionalUsd: 5,
  }),
  precision: Object.freeze({
    defaultPricePrecision: 2,
    defaultQuantityPrecision: 3,
  }),
});

/**
 * @param {object} base
 * @param {object} patch
 * @returns {object}
 * @private
 */
function deepMerge(base, patch) {
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    const baseValue = base[key];
    if (
      patchValue &&
      typeof patchValue === 'object' &&
      !Array.isArray(patchValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      base[key] = deepMerge({ ...baseValue }, patchValue);
    } else {
      base[key] = patchValue;
    }
  }
  return base;
}

/**
 * Deep-merge a partial configuration over {@link DEFAULT_CONFIG}.
 * @param {object} [overrides={}]
 * @returns {object}
 */
export function createConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
}

export default { DEFAULT_CONFIG, createConfig };
