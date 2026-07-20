/**
 * @file Position sizing strategies: fixed, percentage-of-equity, Kelly,
 * ATR-based, volatility-adjusted, and confidence-adjusted.
 * @module risk-engine/PositionSizing
 */

import { computeKellyPositionFraction } from './KellyCriterion.js';

/**
 * Fixed notional size, independent of equity or market conditions.
 * @param {object} config - `config.positionSizing` section.
 * @returns {number} Notional size in quote currency.
 */
export function fixedSize(config) {
  return config.fixedSizeQuote;
}

/**
 * A fixed percentage of current equity.
 * @param {number} equity
 * @param {object} config
 * @returns {number}
 */
export function percentageOfEquitySize(equity, config) {
  return equity * config.percentageOfEquity;
}

/**
 * Kelly-derived size: Kelly fraction of equity, or falls back to
 * `percentageOfEquitySize` when Kelly isn't usable (insufficient
 * sample size or non-positive edge).
 * @param {number} equity
 * @param {import('./KellyCriterion.js').TradeStats} stats
 * @param {object} positionSizingConfig
 * @param {object} kellyConfig
 * @returns {number}
 */
export function kellySize(equity, stats, positionSizingConfig, kellyConfig) {
  const { fraction, usable } = computeKellyPositionFraction(stats, kellyConfig);
  if (!usable) return percentageOfEquitySize(equity, positionSizingConfig);
  return equity * fraction;
}

/**
 * Size derived from risking a fixed dollar amount per unit of ATR
 * distance: notional = (equity * riskPct) / (atrMultiplier * atr / entryPrice).
 * This scales position size inversely with volatility (measured via ATR).
 * @param {number} equity
 * @param {number} entryPrice
 * @param {number} atr
 * @param {object} positionSizingConfig
 * @returns {number}
 */
export function atrPositionSize(equity, entryPrice, atr, positionSizingConfig) {
  const riskAmount = equity * positionSizingConfig.percentageOfEquity;
  const stopDistancePct = (positionSizingConfig.atrRiskMultiplier * atr) / entryPrice;
  if (stopDistancePct <= 0) return 0;
  return riskAmount / stopDistancePct;
}

/**
 * Scales the base percentage-of-equity size down as volatility rises,
 * so higher-volatility symbols get proportionally smaller positions.
 * @param {number} equity
 * @param {number} volatility - Fractional volatility (e.g. ATR/price).
 * @param {object} positionSizingConfig
 * @returns {number}
 */
export function volatilityAdjustedSize(equity, volatility, positionSizingConfig) {
  const base = percentageOfEquitySize(equity, positionSizingConfig);
  // Inverse relationship: doubling volatility roughly halves size, floored to avoid division blow-up.
  const safeVolatility = Math.max(volatility, 0.001);
  const referenceVolatility = 0.02; // "normal" volatility baseline
  const scalingFactor = Math.min(1, referenceVolatility / safeVolatility);
  return base * scalingFactor;
}

/**
 * Scales the base percentage-of-equity size by model confidence,
 * linearly interpolating between `confidenceScalingFloor` (at the
 * rejection-threshold confidence) and 1.0 (at confidence == 1).
 * @param {number} equity
 * @param {number} confidence - 0..1
 * @param {number} minConfidence - The rejection engine's minimum confidence threshold.
 * @param {object} positionSizingConfig
 * @returns {number}
 */
export function confidenceAdjustedSize(equity, confidence, minConfidence, positionSizingConfig) {
  const base = percentageOfEquitySize(equity, positionSizingConfig);
  if (confidence <= minConfidence) return base * positionSizingConfig.confidenceScalingFloor;
  const span = 1 - minConfidence;
  const progress = span <= 0 ? 1 : (confidence - minConfidence) / span;
  const multiplier =
    positionSizingConfig.confidenceScalingFloor +
    progress * (1 - positionSizingConfig.confidenceScalingFloor);
  return base * multiplier;
}

/**
 * Dispatch to the configured sizing method, then clamp to
 * `[minPositionSizeQuote, maxPositionPctOfEquity * equity]`.
 * @param {Object} input
 * @param {number} input.equity
 * @param {number} input.entryPrice
 * @param {number} input.atr
 * @param {number} input.volatility
 * @param {number} input.confidence
 * @param {import('./KellyCriterion.js').TradeStats} [input.tradeStats]
 * @param {object} config - Full risk engine config (uses `positionSizing`, `kelly`, `rejection`).
 * @returns {number} Final clamped notional position size in quote currency.
 */
export function computePositionSize(input, config) {
  const { equity, entryPrice, atr, volatility, confidence, tradeStats } = input;
  const psConfig = config.positionSizing;

  let raw;
  switch (psConfig.method) {
    case 'fixed':
      raw = fixedSize(psConfig);
      break;
    case 'percentageOfEquity':
      raw = percentageOfEquitySize(equity, psConfig);
      break;
    case 'kelly':
      raw = kellySize(equity, tradeStats ?? { winRate: 0, avgWinPct: 0, avgLossPct: 1, sampleSize: 0 }, psConfig, config.kelly);
      break;
    case 'atr':
      raw = atrPositionSize(equity, entryPrice, atr, psConfig);
      break;
    case 'confidenceAdjusted':
      raw = confidenceAdjustedSize(equity, confidence, config.rejection.minConfidence, psConfig);
      break;
    case 'volatilityAdjusted':
    default:
      raw = volatilityAdjustedSize(equity, volatility, psConfig);
      break;
  }

  const maxSize = equity * psConfig.maxPositionPctOfEquity;
  const clamped = Math.min(Math.max(raw, 0), maxSize);
  return clamped < psConfig.minPositionSizeQuote ? 0 : clamped;
}

export default {
  fixedSize,
  percentageOfEquitySize,
  kellySize,
  atrPositionSize,
  volatilityAdjustedSize,
  confidenceAdjustedSize,
  computePositionSize,
};
