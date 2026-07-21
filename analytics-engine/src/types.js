/**
 * @file Shared JSDoc type definitions for the analytics engine's
 * public contract. No runtime logic. All inputs are duck-typed
 * against the shapes reported by Modules 1–9 — this module never
 * imports their source.
 * @module analytics-engine/types
 */

/**
 * A single closed trade, the fundamental unit of analysis. Matches
 * the economically-relevant subset of Module 7's closed `Position`
 * shape, extended with the strategy/AI context Module 3/5 attach.
 * @typedef {Object} TradeRecord
 * @property {string} id
 * @property {string} symbol
 * @property {string} userId
 * @property {string} exchange
 * @property {'LONG'|'SHORT'} side
 * @property {string} [strategy]
 * @property {number} entryPrice
 * @property {number} exitPrice
 * @property {number} quantity
 * @property {number} leverage
 * @property {number} realizedPnl
 * @property {number} fees
 * @property {number} confidence - Decision Engine confidence at entry, 0..1.
 * @property {number} [predictedDirectionCorrect] - 1 if the AI's directional call matched the outcome, 0 if not (set post-hoc).
 * @property {number} openedAt
 * @property {number} closedAt
 */

/**
 * @typedef {Object} EquityPoint
 * @property {number} equity
 * @property {number} timestamp
 */

/**
 * A duck-typed portfolio snapshot, matching Module 8's report shapes.
 * @typedef {Object} PortfolioSnapshot
 * @property {number} equity
 * @property {Object.<string, number>} assetExposure - fraction of equity, 0..1+
 * @property {Object.<string, number>} sectorExposure
 * @property {Object.<string, number>} exchangeExposure
 * @property {Object.<string, number>} strategyExposure
 * @property {number} usedMargin
 * @property {number} totalMargin
 * @property {number} leverage
 */

/**
 * A duck-typed market data snapshot for one symbol at one point in
 * time, matching Module 1/2 output shapes.
 * @typedef {Object} MarketSnapshot
 * @property {string} symbol
 * @property {number} timestamp
 * @property {number} price
 * @property {number} volatility - Fractional (e.g. ATR/price).
 * @property {number} volume
 * @property {number} [fundingRate]
 * @property {number} [openInterest]
 * @property {number} priceChangePct - Over the snapshot's own reporting period.
 */

/**
 * A single benchmark price observation.
 * @typedef {Object} BenchmarkPoint
 * @property {number} price
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ForecastResult
 * @property {number} pointEstimate
 * @property {number} lowerBound
 * @property {number} upperBound
 * @property {number} confidenceLevel
 * @property {number} horizonDays
 */

/**
 * @typedef {Object} HeatmapCell
 * @property {number|string} row
 * @property {number|string} column
 * @property {number} value
 * @property {number} count
 */

export default {};
