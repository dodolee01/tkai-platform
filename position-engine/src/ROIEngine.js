/**
 * @file Return-on-investment math relative to margin committed.
 * @module position-engine/ROIEngine
 */

/**
 * ROI as a percentage of the initial margin committed — the standard
 * "leveraged ROI" figure shown on exchange UIs (distinct from ROI on
 * full notional, which would ignore leverage entirely).
 * @param {number} pnl
 * @param {number} initialMargin
 * @returns {number} Percentage (e.g. 25 = +25%).
 */
export function computeRoi(pnl, initialMargin) {
  if (initialMargin <= 0) return 0;
  return (pnl / initialMargin) * 100;
}

/**
 * ROI relative to full position notional, ignoring leverage — useful
 * for comparing strategies independent of leverage choice.
 * @param {number} pnl
 * @param {number} notional
 * @returns {number}
 */
export function computeUnleveragedRoi(pnl, notional) {
  if (notional <= 0) return 0;
  return (pnl / notional) * 100;
}

export default { computeRoi, computeUnleveragedRoi };
