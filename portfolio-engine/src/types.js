/**
 * @file Shared JSDoc type definitions for the portfolio engine's
 * public contract. No runtime logic. Position/balance inputs are
 * duck-typed against Module 6 (Execution Engine) and Module 7
 * (Position Engine) shapes — this module never imports their source.
 * @module portfolio-engine/types
 */

/**
 * A position as reported by the Position Engine (Module 7). Only the
 * fields this module actually reads are documented here.
 * @typedef {Object} PortfolioPosition
 * @property {string} id
 * @property {string} symbol
 * @property {string} userId
 * @property {string} exchange
 * @property {'LONG'|'SHORT'} side
 * @property {string} state
 * @property {number} remainingQuantity
 * @property {number} markPrice
 * @property {number} unrealizedPnl
 * @property {number} realizedPnl
 * @property {number} initialMargin
 * @property {number} maintenanceMargin
 */

/**
 * A closed trade record used for performance tracking, matching the
 * economically-relevant subset of Module 7's closed `Position` shape.
 * @typedef {Object} ClosedTrade
 * @property {string} symbol
 * @property {string} userId
 * @property {number} realizedPnl
 * @property {number} openedAt
 * @property {number} closedAt
 */

/**
 * Balance for one asset on one exchange account, as reported by an
 * exchange adapter (Module 6 shape: `{asset, available, total}`),
 * extended with margin-account fields this module tracks.
 * @typedef {Object} AssetBalance
 * @property {string} asset
 * @property {string} exchange
 * @property {string} userId
 * @property {number} walletBalance
 * @property {number} availableBalance
 * @property {number} marginBalance
 * @property {number} usedMargin
 */

/**
 * @typedef {Object} Account
 * @property {string} userId
 * @property {string} exchange
 * @property {'hedge'|'one-way'} positionMode
 * @property {number} createdAt
 */

/**
 * @typedef {Object} EquityPoint
 * @property {number} equity
 * @property {number} timestamp
 */

/**
 * @typedef {Object} EquityReport
 * @property {number} currentEquity
 * @property {number} dailyEquity
 * @property {number} weeklyEquity
 * @property {number} monthlyEquity
 * @property {number} peakEquity
 * @property {number} lowestEquity
 */

/**
 * @typedef {Object} ExposureReport
 * @property {number} totalExposure
 * @property {number} longExposure
 * @property {number} shortExposure
 * @property {Object.<string, number>} symbolExposure
 * @property {Object.<string, number>} assetExposure
 * @property {Object.<string, number>} sectorExposure
 * @property {Object.<string, number>} correlationExposure
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} AllocationReport
 * @property {Object.<string, number>} byAsset
 * @property {Object.<string, number>} bySector
 * @property {Object.<string, number>} byStrategy
 * @property {Object.<string, number>} byExchange
 */

/**
 * @typedef {Object} CapitalReport
 * @property {number} availableCapital
 * @property {number} reservedCapital
 * @property {number} riskCapital
 * @property {number} maxDeployableCapital
 */

/**
 * @typedef {Object} PerformanceReport
 * @property {number} netProfit
 * @property {number} grossProfit
 * @property {number} grossLoss
 * @property {number} profitFactor
 * @property {number} winRate
 * @property {number} averageTrade
 * @property {number} averageHoldingTimeMs
 * @property {number} roi
 * @property {number} cagr
 * @property {number} sharpeRatio
 * @property {number} sortinoRatio
 * @property {number} calmarRatio
 * @property {number} recoveryFactor
 */

/**
 * An immutable, timestamped point-in-time capture of the whole
 * portfolio state.
 * @typedef {Object} PortfolioSnapshotRecord
 * @property {string} id
 * @property {'realtime'|'daily'|'weekly'|'monthly'} granularity
 * @property {number} timestamp
 * @property {EquityReport} equity
 * @property {ExposureReport} exposure
 * @property {AllocationReport} allocation
 * @property {CapitalReport} capital
 * @property {PerformanceReport} performance
 */

export default {};
