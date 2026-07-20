/**
 * @file Initial/maintenance margin and margin ratio math.
 * @module position-engine/MarginCalculator
 */

/**
 * @param {number} notional
 * @param {number} leverage
 * @returns {number}
 */
export function computeInitialMargin(notional, leverage) {
  if (leverage <= 0) throw new Error('MarginCalculator: leverage must be positive');
  return notional / leverage;
}

/**
 * Maintenance margin from a notional and a rate. Real exchanges use a
 * notional-tiered bracket table (larger positions require a higher
 * maintenance margin rate with a per-tier deduction) — when a bracket
 * table is supplied via `brackets`, it is used; otherwise the single
 * configured `defaultMaintenanceMarginRate` applies. This is an
 * explicit, documented simplification for symbols/exchanges where a
 * bracket table hasn't been wired in yet.
 * @param {number} notional
 * @param {number} [defaultRate=0.004]
 * @param {Array<{notionalFloor:number, notionalCap:number, maintenanceMarginRate:number, maintenanceAmount:number}>} [brackets]
 * @returns {number}
 */
export function computeMaintenanceMargin(notional, defaultRate = 0.004, brackets = null) {
  if (!brackets || brackets.length === 0) {
    return notional * defaultRate;
  }
  const bracket = brackets.find((b) => notional >= b.notionalFloor && notional <= b.notionalCap) ?? brackets[brackets.length - 1];
  return notional * bracket.maintenanceMarginRate - bracket.maintenanceAmount;
}

/**
 * Margin ratio: maintenance margin / margin balance (wallet margin +
 * unrealized PnL). A ratio approaching 1.0 signals imminent liquidation.
 * @param {number} maintenanceMargin
 * @param {number} marginBalance
 * @returns {number}
 */
export function computeMarginRatio(maintenanceMargin, marginBalance) {
  if (marginBalance <= 0) return Infinity;
  return maintenanceMargin / marginBalance;
}

/**
 * @param {number} marginRatio
 * @param {number} marginCallRatio
 * @returns {boolean}
 */
export function isMarginCallLevel(marginRatio, marginCallRatio) {
  return marginRatio >= marginCallRatio;
}

export default { computeInitialMargin, computeMaintenanceMargin, computeMarginRatio, isMarginCallLevel };
