/**
 * @file Liquidation price estimation.
 * @module position-engine/LiquidationCalculator
 */

/**
 * Estimate the isolated-margin liquidation price using the standard
 * simplified approximation (ignoring trading fees and using a flat
 * maintenance margin rate rather than a notional-tiered bracket):
 *
 *   LONG:  liqPrice = entryPrice * (1 - 1/leverage + maintenanceMarginRate)
 *   SHORT: liqPrice = entryPrice * (1 + 1/leverage - maintenanceMarginRate)
 *
 * This matches the commonly published approximation for isolated
 * margin USDⓈ-M perpetuals and is accurate enough for monitoring and
 * alerting. For cent-precise liquidation prices, an exchange's own
 * tiered maintenance-margin bracket and wallet-balance-based formula
 * must be used — this function documents that assumption rather than
 * silently pretending to be exact.
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} leverage
 * @param {number} maintenanceMarginRate
 * @returns {number}
 */
export function estimateLiquidationPrice(side, entryPrice, leverage, maintenanceMarginRate) {
  if (leverage <= 0) throw new Error('LiquidationCalculator: leverage must be positive');
  const inverseLeverage = 1 / leverage;
  if (side === 'LONG') {
    return entryPrice * (1 - inverseLeverage + maintenanceMarginRate);
  }
  return entryPrice * (1 + inverseLeverage - maintenanceMarginRate);
}

/**
 * Distance from the current mark price to the liquidation price, as a
 * fraction of the mark price — useful for alerting ("liquidation is
 * within 5% of current price").
 * @param {'LONG'|'SHORT'} side
 * @param {number} markPrice
 * @param {number} liquidationPrice
 * @returns {number} Always non-negative; 0 means liquidation is imminent/breached.
 */
export function distanceToLiquidationPct(side, markPrice, liquidationPrice) {
  if (markPrice <= 0) return 0;
  const distance = side === 'LONG' ? markPrice - liquidationPrice : liquidationPrice - markPrice;
  return Math.max(0, distance / markPrice) * 100;
}

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} markPrice
 * @param {number} liquidationPrice
 * @returns {boolean}
 */
export function isLiquidated(side, markPrice, liquidationPrice) {
  return side === 'LONG' ? markPrice <= liquidationPrice : markPrice >= liquidationPrice;
}

export default { estimateLiquidationPrice, distanceToLiquidationPct, isLiquidated };
