/**
 * TK AI Finance - Module 3: AI Decision Engine
 * Config.js
 *
 * Every threshold used anywhere in the engine lives here. Nothing in the
 * analyzers, filters or scoring layer hardcodes a magic number - they all
 * read from an EngineConfig instance produced by createConfig().
 */

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Recursively merges `override` on top of `base` without mutating either.
 * Arrays and non-plain-object values are replaced wholesale, plain objects
 * are merged key by key.
 *
 * @template T
 * @param {T} base
 * @param {Partial<T>} [override]
 * @returns {T}
 */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) {
    return base;
  }

  const result = { ...base };

  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = result[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue;
    }
  }

  return result;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation of `value` between [inMin, inMax] onto [outMin, outMax],
 * clamped to the output range.
 *
 * @param {number} value
 * @param {number} inMin
 * @param {number} inMax
 * @param {number} outMin
 * @param {number} outMax
 * @returns {number}
 */
export function scaleRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return clamp(outMin + t * (outMax - outMin), Math.min(outMin, outMax), Math.max(outMin, outMax));
}

/**
 * @param {number} value
 * @param {number} [decimals]
 * @returns {number}
 */
export function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Safe division that returns `fallback` instead of NaN/Infinity.
 *
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} [fallback]
 * @returns {number}
 */
export function safeDivide(numerator, denominator, fallback = 0) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

/** @type {const} */
export const DEFAULT_CONFIG = {
  decision: {
    // Total weighted score (-100..100) required to trigger a directional call.
    longThreshold: 35,
    shortThreshold: -35,
    // Minimum confidence (0..100) required to keep a LONG/SHORT call instead
    // of downgrading it to WAIT.
    minConfidence: 55,
    // Opposing score magnitude required to flip an open LONG/SHORT into EXIT.
    exitReversalThreshold: 40
  },

  trend: {
    adxStrong: 30,
    adxWeak: 18,
    // Fractional buffer (of price) used when testing price vs the Ichimoku cloud.
    ichimokuCloudBuffer: 0.001,
    // Fractional distance from EMA20 considered a "pullback into trend".
    pullbackBandPercent: 0.6
  },

  momentum: {
    rsiOverbought: 70,
    rsiOversold: 30,
    rsiMidHigh: 55,
    rsiMidLow: 45,
    stochOverbought: 80,
    stochOversold: 20,
    mfiOverbought: 80,
    mfiOversold: 20,
    cciOverbought: 100,
    cciExtreme: 200,
    cciOversold: -100,
    cciExtremeLow: -200,
    williamsROverbought: -20,
    williamsROversold: -80
  },

  volatility: {
    atrPercentLow: 0.5,
    atrPercentHigh: 2.5,
    bollingerSqueezePercent: 2.0,
    bollingerWidePercent: 6.0
  },

  orderflow: {
    // Absolute funding rate (fraction, e.g. 0.0005 = 0.05%) beyond which the
    // rate is considered a meaningful directional bias rather than noise.
    fundingNeutralBand: 0.0001,
    fundingOverheated: 0.0015,
    orderBookImbalanceThreshold: 0.15,
    cmfThreshold: 0.05,
    volumeProfileEdgeBufferPercent: 0.05
  },

  filters: {
    // Minimum |delta| required for a move to be considered volume-confirmed.
    // 0 disables the filter (useful when Module 1 does not supply delta).
    minVolumeDeltaAbs: 0,
    // How balanced bullish/bearish weight must be before it counts as a
    // genuine conflict (0..1, 1 = perfectly balanced).
    conflictRatioThreshold: 0.75,
    // Confidence points subtracted when a conflict is detected.
    conflictPenalty: 18,
    // Confidence points subtracted when a breakout lacks order-flow confirmation.
    fakeBreakoutPenalty: 25,
    exhaustionRsiExtreme: 78,
    exhaustionStochExtreme: 88,
    exhaustionPenalty: 12,
    continuationBonus: 8
  },

  newsRisk: {
    fundingAbsSpike: 0.003,
    liquidationSpikeUsd: 5_000_000
  },

  risk: {
    leverageByRisk: { LOW: 5, MEDIUM: 3, HIGH: 1 },
    maxLeverage: 10,
    baseRiskPercent: 1.0,
    maxRiskPercent: 2.0,
    riskLevelConfidenceFloor: { LOW: 70, MEDIUM: 45 }
  },

  history: {
    // How many prior snapshots are retained per symbol/timeframe key.
    maxSnapshotsPerKey: 20
  }
};

/**
 * @param {Partial<typeof DEFAULT_CONFIG>} [overrides]
 * @returns {typeof DEFAULT_CONFIG}
 */
export function createConfig(overrides = {}) {
  return deepMerge(DEFAULT_CONFIG, overrides);
}
