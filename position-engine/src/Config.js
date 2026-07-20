/**
 * @file Central, fully-overridable configuration for the position engine.
 * @module position-engine/Config
 */

export const DEFAULT_CONFIG = Object.freeze({
  margin: Object.freeze({
    // Simplified single-tier maintenance margin rate, used when no
    // exchange-specific bracket table is supplied. Real venues use a
    // notional-tiered bracket system; see MarginCalculator.js docs.
    defaultMaintenanceMarginRate: 0.004,
    marginCallRatio: 0.8, // margin ratio at/above which a warning should fire, before actual liquidation at 1.0
  }),
  breakEven: Object.freeze({
    method: 'riskMultiple', // 'fixedPct' | 'atrMultiple' | 'riskMultiple'
    fixedPctTrigger: 0.01, // 1% move in favor
    atrMultiple: 1.5,
    riskMultipleTrigger: 1.0, // 1R of profit
    offsetPct: 0.0005,
  }),
  trailing: Object.freeze({
    method: 'percentage', // 'atr' | 'percentage' | 'step' | 'dynamic'
    percentageDistance: 0.01,
    atrMultiple: 2.0,
    stepSizePct: 0.005, // dynamic/step trailing moves in discrete jumps of this size
    stepTriggerPct: 0.01, // must move this much further before the next step fires
    dynamicLowVolMultiple: 1.2,
    dynamicHighVolMultiple: 2.5,
    dynamicVolatilityThreshold: 0.03,
    activationRR: 1.0,
  }),
  drawdown: Object.freeze({
    maxDrawdownPct: 0.25,
  }),
  exposure: Object.freeze({
    maxPortfolioExposurePct: 0.6,
    maxSymbolExposurePct: 0.15,
    maxSectorExposurePct: 0.35,
    maxCorrelatedExposurePct: 0.3,
    sectorMap: Object.freeze({}), // symbol -> sector, e.g. { BTCUSDT: 'majors', ETHUSDT: 'majors' }
    correlationGroups: Object.freeze({}), // symbol -> correlation group id
  }),
  statistics: Object.freeze({
    riskFreeRatePerTrade: 0,
    annualizationFactor: 252,
  }),
  synchronizer: Object.freeze({
    quantityEpsilon: 1e-8, // tolerance for float-comparison of quantities when diffing against the exchange
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
