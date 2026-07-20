/**
 * @file Unrealized and realized PnL math. Pure functions.
 * @module position-engine/PnLCalculator
 */

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} markPrice
 * @param {number} quantity
 * @returns {number}
 */
export function computeUnrealizedPnl(side, entryPrice, markPrice, quantity) {
  const priceDelta = side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
  return priceDelta * quantity;
}

/**
 * Realized PnL for closing `closeQuantity` units at `closePrice`.
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} closePrice
 * @param {number} closeQuantity
 * @returns {number}
 */
export function computeRealizedPnl(side, entryPrice, closePrice, closeQuantity) {
  const priceDelta = side === 'LONG' ? closePrice - entryPrice : entryPrice - closePrice;
  return priceDelta * closeQuantity;
}

/**
 * Net PnL after fees (trading fees + funding fees), for reporting.
 * @param {number} grossPnl
 * @param {number} tradingFees
 * @param {number} fundingFees
 * @returns {number}
 */
export function computeNetPnl(grossPnl, tradingFees, fundingFees) {
  return grossPnl - tradingFees - fundingFees;
}

export default { computeUnrealizedPnl, computeRealizedPnl, computeNetPnl };
