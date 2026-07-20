/**
 * @file Central, fully-overridable configuration for the portfolio engine.
 * @module portfolio-engine/Config
 */

export const DEFAULT_CONFIG = Object.freeze({
  margin: Object.freeze({
    marginCallRatio: 0.8,
  }),
  exposure: Object.freeze({
    maxTotalExposurePct: 3.0, // as a multiple of equity (i.e. max aggregate leverage across the portfolio)
    maxSymbolExposurePct: 0.2,
    maxAssetExposurePct: 0.3,
    maxSectorExposurePct: 0.4,
    maxCorrelatedExposurePct: 0.35,
    sectorMap: Object.freeze({}),
    correlationGroups: Object.freeze({}),
  }),
  capital: Object.freeze({
    model: 'fixedReserve', // 'fixedReserve' | 'tiered'
    reservePct: 0.2, // fraction of equity held back, never deployable
    riskCapitalPct: 0.5, // fraction of deployable capital considered "at risk" budget
    tiers: Object.freeze([
      // used when model === 'tiered': cumulative reserve grows with equity
      Object.freeze({ equityFloor: 0, reservePct: 0.3 }),
      Object.freeze({ equityFloor: 50000, reservePct: 0.2 }),
      Object.freeze({ equityFloor: 250000, reservePct: 0.1 }),
    ]),
  }),
  performance: Object.freeze({
    riskFreeRatePerTrade: 0,
    annualizationFactor: 252,
  }),
  snapshot: Object.freeze({
    dailyIntervalMs: 24 * 60 * 60 * 1000,
    weeklyIntervalMs: 7 * 24 * 60 * 60 * 1000,
    monthlyIntervalMs: 30 * 24 * 60 * 60 * 1000,
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
