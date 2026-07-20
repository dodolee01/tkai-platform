/**
 * @file Shared JSDoc type definitions for the position engine's
 * public contract. No runtime logic.
 * @module position-engine/types
 */

/**
 * @typedef {'NEW'|'OPENING'|'OPEN'|'PARTIALLY_CLOSED'|'TRAILING'|'CLOSING'|'CLOSED'|'ARCHIVED'} PositionState
 */

/**
 * The full internal record for one open (or historical) position.
 * @typedef {Object} Position
 * @property {string} id
 * @property {string} symbol
 * @property {string} userId
 * @property {string} exchange
 * @property {'LONG'|'SHORT'} side
 * @property {'hedge'|'one-way'} positionMode
 * @property {PositionState} state
 * @property {number} entryPrice
 * @property {number} averageEntryPrice
 * @property {number} markPrice
 * @property {number} quantity - Original opened quantity.
 * @property {number} remainingQuantity - Quantity still open after any partial closes.
 * @property {number} leverage
 * @property {number} initialMargin
 * @property {number} maintenanceMargin
 * @property {number} liquidationPrice
 * @property {number} marginRatio
 * @property {number} unrealizedPnl
 * @property {number} realizedPnl
 * @property {number} fundingFees
 * @property {number} tradingFees
 * @property {number} roi
 * @property {number|null} stopLoss - Current stop-loss price (may be adjusted by break-even/trailing).
 * @property {number|null} initialStopLoss - The stop-loss price at position open, immutable — used as the fixed risk denominator for R-multiple calculations even after break-even/trailing move `stopLoss`.
 * @property {number|null} takeProfit
 * @property {boolean} breakEvenActivated
 * @property {boolean} trailingActive
 * @property {number} openedAt
 * @property {number} updatedAt
 * @property {number|null} closedAt
 * @property {Array<{price:number, quantity:number, closedAt:number, realizedPnl:number}>} closeHistory
 */

/**
 * @typedef {Object} TradeFill
 * @property {number} price
 * @property {number} quantity
 * @property {number} fee
 * @property {number} timestamp
 */

/**
 * A duck-typed snapshot of a position as reported by an exchange
 * adapter (matching Module 6's `ExchangeAdapter#getPosition` shape).
 * This module never imports Module 6's source — synchronization is
 * driven purely by this shape, supplied via dependency injection.
 * @typedef {Object} ExchangePositionSnapshot
 * @property {string} symbol
 * @property {'LONG'|'SHORT'|'FLAT'} side
 * @property {number} quantity
 * @property {number} entryPrice
 * @property {number} leverage
 * @property {number} unrealizedPnl
 */

/**
 * @typedef {Object} SyncDifference
 * @property {'manual_close'|'manual_reduction'|'manual_leverage_change'|'manual_margin_change'|'no_change'} type
 * @property {string} positionId
 * @property {object} details
 */

/**
 * @typedef {Object} PositionStatisticsReport
 * @property {number} totalTrades
 * @property {number} winRate
 * @property {number} lossRate
 * @property {number} averageWin
 * @property {number} averageLoss
 * @property {number} largestWin
 * @property {number} largestLoss
 * @property {number} profitFactor
 * @property {number} sharpeRatio
 * @property {number} sortinoRatio
 * @property {number} recoveryFactor
 * @property {number} expectancy
 * @property {number} averageHoldingTimeMs
 */

/**
 * @typedef {Object} DrawdownReport
 * @property {number} dailyDrawdownPct
 * @property {number} weeklyDrawdownPct
 * @property {number} monthlyDrawdownPct
 * @property {number} maxDrawdownPct
 * @property {number} currentDrawdownPct
 * @property {number} recoveryPct
 */

/**
 * @typedef {Object} ExposureReport
 * @property {number} totalPortfolioExposurePct
 * @property {Object.<string, number>} symbolExposurePct
 * @property {Object.<string, number>} sectorExposurePct
 * @property {Object.<string, number>} correlationGroupExposurePct
 * @property {string[]} warnings
 */

export default {};
