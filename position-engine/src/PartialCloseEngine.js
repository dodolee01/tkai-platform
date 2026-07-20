/**
 * @file Partial position closes: fixed percentages (10/25/50/75) or a
 * custom fraction, with full recalculation of remaining quantity,
 * average entry, ROI, PnL, and risk after the close.
 * @module position-engine/PartialCloseEngine
 */

import { computeRealizedPnl } from './PnLCalculator.js';
import { computeRoi } from './ROIEngine.js';
import { computeInitialMargin } from './MarginCalculator.js';

/** @type {number[]} Common preset fractions, exposed for UI convenience. */
export const PRESET_FRACTIONS = Object.freeze([0.1, 0.25, 0.5, 0.75]);

/**
 * @typedef {Object} PartialCloseResult
 * @property {number} closedQuantity
 * @property {number} remainingQuantity
 * @property {number} realizedPnl
 * @property {number} newInitialMargin - Initial margin recomputed for the reduced notional.
 * @property {number} newRoi - ROI on the closed portion.
 * @property {boolean} isFullyClosed - True if `remainingQuantity` rounds to zero.
 */

/**
 * Execute a partial close against a position's current state.
 * Average entry price is deliberately unchanged by a partial close —
 * only scaling IN changes average entry; scaling OUT (this operation)
 * realizes PnL on the closed slice at the existing average entry.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.averageEntryPrice
 * @param {number} input.remainingQuantity
 * @param {number} input.closePrice
 * @param {number} input.leverage
 * @param {number} fraction - 0 < fraction <= 1, fraction of the CURRENT remaining quantity to close.
 * @param {number} [quantityEpsilon=1e-8]
 * @returns {PartialCloseResult}
 */
export function executePartialClose(input, fraction, quantityEpsilon = 1e-8) {
  if (!(fraction > 0 && fraction <= 1)) {
    throw new Error('PartialCloseEngine: fraction must be in (0, 1]');
  }
  const { side, averageEntryPrice, remainingQuantity, closePrice, leverage } = input;

  const closedQuantity = remainingQuantity * fraction;
  const newRemainingQuantity = remainingQuantity - closedQuantity;
  const realizedPnl = computeRealizedPnl(side, averageEntryPrice, closePrice, closedQuantity);
  const newInitialMargin = computeInitialMargin(closedQuantity * averageEntryPrice, leverage);
  const newRoi = computeRoi(realizedPnl, newInitialMargin);

  return {
    closedQuantity,
    remainingQuantity: newRemainingQuantity < quantityEpsilon ? 0 : newRemainingQuantity,
    realizedPnl,
    newInitialMargin,
    newRoi,
    isFullyClosed: newRemainingQuantity < quantityEpsilon,
  };
}

/**
 * Convenience wrapper for one of the standard preset fractions.
 * @param {Object} input - Same shape as {@link executePartialClose}'s `input`.
 * @param {10|25|50|75} presetPercent
 * @returns {PartialCloseResult}
 */
export function executePresetPartialClose(input, presetPercent) {
  if (![10, 25, 50, 75].includes(presetPercent)) {
    throw new Error('PartialCloseEngine: presetPercent must be one of 10, 25, 50, 75');
  }
  return executePartialClose(input, presetPercent / 100);
}

export default { PRESET_FRACTIONS, executePartialClose, executePresetPartialClose };
