/**
 * @file Central, fully-overridable configuration for the notification engine.
 * @module notification-engine/Config
 */

import { Priority } from './NotificationPriority.js';

export const DEFAULT_CONFIG = Object.freeze({
  routing: Object.freeze({
    [Priority.CRITICAL]: Object.freeze(['telegram', 'discord', 'sms', 'email']),
    [Priority.HIGH]: Object.freeze(['telegram', 'discord', 'email']),
    [Priority.MEDIUM]: Object.freeze(['telegram', 'inApp']),
    [Priority.LOW]: Object.freeze(['inApp']),
    [Priority.INFO]: Object.freeze(['inApp']),
    DEFAULT: Object.freeze(['inApp']),
  }),
  queue: Object.freeze({
    maxConcurrentDeliveries: 10,
    delayedCheckIntervalMs: 1000,
  }),
  retry: Object.freeze({
    strategy: 'exponential', // 'exponential' | 'linear'
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    multiplier: 2, // used by exponential
    incrementMs: 2000, // used by linear
  }),
  deduplication: Object.freeze({
    windowMs: 5 * 60 * 1000,
    maxTrackedKeys: 10000,
  }),
  rateLimiter: Object.freeze({
    perMinute: 30,
    perHour: 300,
    perDay: 2000,
  }),
  history: Object.freeze({
    maxRecords: 50000,
  }),
  health: Object.freeze({
    failureRateWarnThreshold: 0.2,
    failureRateCriticalThreshold: 0.5,
    queueSizeWarnThreshold: 500,
    queueSizeCriticalThreshold: 2000,
  }),
  metrics: Object.freeze({
    sampleWindowMs: 60000,
  }),
  logging: Object.freeze({
    level: 'info',
    dir: './logs',
    filename: 'notification-engine.log',
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxFiles: 10,
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
 * @param {object} [overrides={}]
 * @returns {object}
 */
export function createConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
}

export default { DEFAULT_CONFIG, createConfig };
