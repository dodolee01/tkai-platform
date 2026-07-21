/**
 * @file Central, fully-overridable configuration for the AI core engine.
 * @module ai-core-engine/Config
 */

export const DEFAULT_CONFIG = Object.freeze({
  routing: Object.freeze({
    defaultPriority: 'quality', // 'cost' | 'latency' | 'quality'
    qualityRank: Object.freeze(['claude', 'openai', 'gemini', 'deepseek', 'kimi']), // best-to-worst default preference when priority='quality'
  }),
  memory: Object.freeze({
    shortTermTurnLimit: 20, // most recent conversation turns kept verbatim
    longTermFactLimit: 200,
    contextWindowTokenBudget: 8000,
    sessionIdleTtlMs: 30 * 60 * 1000,
  }),
  cache: Object.freeze({
    maxEntries: 500,
    ttlMs: 5 * 60 * 1000,
  }),
  rateLimiter: Object.freeze({
    perUserPerMinute: 10,
    perUserPerHour: 200,
    perProviderPerMinute: 60,
    perProviderPerHour: 2000,
  }),
  tokens: Object.freeze({
    // Fallback heuristic when a provider response doesn't report usage:
    // ~4 characters per token is a standard rough approximation for
    // English text; real tokenization requires a model-specific
    // tokenizer library not bundled here (documented in TokenManager.js).
    charsPerTokenEstimate: 4,
  }),
  cost: Object.freeze({
    monthlyBudgetUsd: 500,
  }),
  vectorMemory: Object.freeze({
    maxVectors: 5000,
    defaultTopK: 5,
  }),
  reasoning: Object.freeze({
    maxToolCallRounds: 5,
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
