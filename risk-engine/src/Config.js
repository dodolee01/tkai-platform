/**
 * @file Central, fully-overridable configuration for the risk engine.
 * Every numeric threshold used anywhere in this module is sourced
 * from here — no other file hardcodes a risk parameter.
 * @module risk-engine/Config
 */

/**
 * @typedef {Object} RiskEngineConfig
 * @property {object} kelly
 * @property {object} positionSizing
 * @property {object} stopLoss
 * @property {object} takeProfit
 * @property {object} exposure
 * @property {object} leverage
 * @property {object} drawdown
 * @property {object} circuitBreaker
 * @property {object} cooldown
 * @property {object} dailyLimits
 * @property {object} riskScore
 * @property {object} rejection
 */

/**
 * Default configuration. Every field here may be overridden via
 * {@link createConfig}; nothing in the rest of the module reads a
 * bare numeric literal for a risk threshold.
 * @type {RiskEngineConfig}
 */
export const DEFAULT_CONFIG = Object.freeze({
  kelly: Object.freeze({
    enabled: true,
    kellyFractionMultiplier: 0.5, // "half-Kelly" for safety
    maxKellyFraction: 0.25, // never risk more than 25% of equity even if raw Kelly says more
    minSampleTrades: 20, // below this many historical trades, Kelly falls back to fixed-fractional
  }),
  positionSizing: Object.freeze({
    method: 'volatilityAdjusted', // 'fixed' | 'percentageOfEquity' | 'kelly' | 'atr' | 'volatilityAdjusted' | 'confidenceAdjusted'
    fixedSizeQuote: 1000,
    percentageOfEquity: 0.02, // 2% of equity per trade (notional-at-risk basis, see PositionSizing.js)
    atrRiskMultiplier: 1.5,
    maxPositionPctOfEquity: 0.25,
    minPositionSizeQuote: 10,
    confidenceScalingFloor: 0.5, // at confidence == minConfidence, size multiplier is this fraction
  }),
  stopLoss: Object.freeze({
    atrMultiplier: 1.5,
    minStopDistancePct: 0.002, // 0.2% minimum distance to avoid a degenerate stop on ultra-low ATR
    trailing: Object.freeze({
      enabled: true,
      atrMultiplier: 2.0,
      activationRR: 1.0, // trailing stop only engages once price has moved 1R in favor
    }),
    breakEven: Object.freeze({
      enabled: true,
      triggerRR: 1.0, // move stop to break-even once 1R of profit is reached
      offsetPct: 0.0005, // small buffer beyond entry so break-even isn't a scratch-to-loss on noise
    }),
  }),
  takeProfit: Object.freeze({
    minRiskReward: 1.5,
    targets: Object.freeze([
      Object.freeze({ rMultiple: 1.0, sizePct: 0.4 }),
      Object.freeze({ rMultiple: 2.0, sizePct: 0.35 }),
      Object.freeze({ rMultiple: 3.5, sizePct: 0.25 }),
    ]),
    volatilityExpansion: Object.freeze({
      enabled: true,
      highVolatilityThreshold: 0.04, // volatility (as a fraction) above which targets are widened
      expansionFactor: 1.2,
    }),
  }),
  exposure: Object.freeze({
    maxPortfolioExposurePct: 0.6, // sum of all open position notionals <= 60% of equity
    maxSymbolExposurePct: 0.15,
    maxCorrelatedExposurePct: 0.3,
    correlationGroups: Object.freeze({}), // symbol -> group id, e.g. { BTCUSDT: 'majors', ETHUSDT: 'majors' }
  }),
  leverage: Object.freeze({
    maxLeverage: 10,
    minLeverage: 1,
    highVolatilityThreshold: 0.04,
    highVolatilityReductionFactor: 0.5,
    lowConfidenceThreshold: 0.6,
    lowConfidenceReductionFactor: 0.6,
    drawdownReductionThreshold: 0.1, // once drawdown exceeds 10%, leverage is reduced
    drawdownReductionFactor: 0.5,
  }),
  drawdown: Object.freeze({
    maxDrawdownPct: 0.2, // circuit breaker territory
    equityProtectionThresholdPct: 0.3, // hard kill-switch: equity fell 30% from peak
  }),
  circuitBreaker: Object.freeze({
    maxDailyLossPct: 0.05,
    maxConsecutiveLosses: 4,
    tripCooldownMs: 4 * 60 * 60 * 1000, // 4 hours
  }),
  cooldown: Object.freeze({
    afterLossMs: 15 * 60 * 1000, // 15 minutes per-symbol cooldown after any losing trade
    afterConsecutiveLossesCount: 2,
    extendedCooldownMs: 60 * 60 * 1000, // 1 hour if 2+ consecutive losses on the same symbol
  }),
  dailyLimits: Object.freeze({
    maxDailyTrades: 20,
    maxDailyLossPct: 0.05,
  }),
  riskScore: Object.freeze({
    // Weighted 0-100 composite; weights must sum to 1.
    weights: Object.freeze({
      volatility: 0.25,
      confidence: 0.2,
      portfolioHeat: 0.25,
      drawdown: 0.2,
      marketState: 0.1,
    }),
    dangerousMarketStates: Object.freeze(['extreme_volatility', 'illiquid', 'news_event', 'flash_crash']),
  }),
  rejection: Object.freeze({
    minConfidence: 0.55,
    minRiskReward: 1.5,
    maxVolatility: 0.08,
    dangerousMarketStates: Object.freeze(['extreme_volatility', 'illiquid', 'news_event', 'flash_crash']),
    maxNewsRiskLevel: 'medium', // 'none' | 'low' | 'medium' | 'high' — reject if input.newsRisk exceeds this
  }),
});

const NEWS_RISK_LEVELS = ['none', 'low', 'medium', 'high'];

/**
 * Deep-merge a partial configuration over {@link DEFAULT_CONFIG}.
 * Arrays are replaced wholesale (not merged element-wise) so callers
 * can fully override e.g. `takeProfit.targets`.
 * @param {object} [overrides={}]
 * @returns {RiskEngineConfig}
 */
export function createConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), overrides);
}

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
 * @returns {string[]} Valid news-risk level strings, ordered low to high.
 */
export function getNewsRiskLevels() {
  return NEWS_RISK_LEVELS.slice();
}

export default { DEFAULT_CONFIG, createConfig, getNewsRiskLevels };
