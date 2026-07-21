/**
 * @file Central, fully-overridable configuration for the monitoring engine.
 * @module monitoring-engine/Config
 */

export const DEFAULT_CONFIG = Object.freeze({
  healthCheck: Object.freeze({
    intervalMs: 30000,
    timeoutMs: 5000,
  }),
  heartbeat: Object.freeze({
    expectedIntervalMs: 15000,
    missingThresholdMs: 45000, // 3 missed beats
    slowThresholdMs: 25000,
  }),
  thresholds: Object.freeze({
    cpu: Object.freeze({ warnPct: 70, criticalPct: 90 }),
    memory: Object.freeze({ warnPct: 75, criticalPct: 90 }),
    swap: Object.freeze({ warnPct: 50, criticalPct: 80 }),
    disk: Object.freeze({ warnPct: 80, criticalPct: 95 }),
    eventLoopDelay: Object.freeze({ warnMs: 100, criticalMs: 500 }),
  }),
  watchdog: Object.freeze({
    checkIntervalMs: 10000,
    cpuSpikeSustainedChecks: 3, // consecutive over-threshold checks before flagging a spike
    memoryLeakWindowSize: 10, // samples used to compute the heap-growth trend
    memoryLeakSlopeBytesPerSampleThreshold: 5 * 1024 * 1024, // 5MB growth per sample, sustained -> suspected leak
    hungServiceTimeoutMs: 60000,
  }),
  recovery: Object.freeze({
    maxAttempts: 3,
    baseDelayMs: 1000,
    multiplier: 2,
    maxDelayMs: 30000,
  }),
  incident: Object.freeze({
    autoResolveOnRecoveryEvent: true,
  }),
  api: Object.freeze({
    defaultTimeoutMs: 5000,
  }),
  disk: Object.freeze({
    monitoredPath: '/',
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
