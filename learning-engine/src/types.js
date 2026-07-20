/**
 * @file Shared JSDoc type definitions for the learning engine's public
 * contract. No runtime logic.
 * @module learning-engine/types
 */

/**
 * A completed trade, as reported by the Execution Engine once a
 * position is fully closed.
 * @typedef {Object} CompletedTrade
 * @property {string} symbol
 * @property {string} timeframe
 * @property {number} entryPrice
 * @property {number} exitPrice
 * @property {number} stopLoss
 * @property {number} takeProfit
 * @property {'LONG'|'SHORT'} side
 * @property {number} leverage
 * @property {number} quantity
 * @property {number} pnl - Realized PnL in quote currency.
 * @property {number} pnlPercent - Realized PnL as a fraction of equity at entry (e.g. 0.02 = +2%).
 * @property {number} fees
 * @property {number} confidence - The Decision Engine's confidence at entry, 0..1.
 * @property {string} marketState - One of the configured market regimes (see Config.js MARKET_REGIMES), or any caller-defined string.
 * @property {number} trendStrength - 0..1
 * @property {number} volatility - Fractional volatility at entry.
 * @property {number} riskScore - 0..100, from the Risk Engine.
 * @property {number} rrRatio - Planned risk:reward ratio at entry.
 * @property {number} executionTime - Trade duration in milliseconds.
 * @property {'LONG'|'SHORT'|'WAIT'|'EXIT'} decision
 * @property {string[]} bullishSignals
 * @property {string[]} bearishSignals
 * @property {object} scoreBreakdown
 * @property {object} indicatorSnapshot - Raw indicator values at entry (from Module 1).
 * @property {number} [timestamp] - Trade close time, Unix ms. Defaults to record time if omitted.
 */

/**
 * @typedef {Object} IndicatorPerformance
 * @property {string} indicator
 * @property {number} appearances
 * @property {number} wins
 * @property {number} losses
 * @property {number} winRate
 * @property {number} avgPnlPercent
 * @property {number} expectancy
 * @property {number} weight - Current optimized weight (1.0 = neutral baseline).
 */

/**
 * @typedef {Object} StrategyPerformance
 * @property {string} strategyKey
 * @property {number} trades
 * @property {import('./PerformanceMetrics.js').PerformanceStats} stats
 */

/**
 * @typedef {Object} MarketStatePerformance
 * @property {string} marketState
 * @property {number} trades
 * @property {import('./PerformanceMetrics.js').PerformanceStats} stats
 */

/**
 * @typedef {Object} CalibrationBucket
 * @property {number} bucketIndex
 * @property {number} rangeStart
 * @property {number} rangeEnd
 * @property {number} sampleSize
 * @property {number} avgPredictedConfidence
 * @property {number} actualWinRate
 * @property {number} calibratedConfidence
 */

/**
 * @typedef {Object} Recommendation
 * @property {'REDUCE_WEIGHT'|'INCREASE_WEIGHT'|'AVOID_MARKET_STATE'|'RECALIBRATE_CONFIDENCE'|'OVERFITTING_WARNING'|'INSUFFICIENT_SAMPLE'|'STRATEGY_UNDERPERFORMING'|'STRATEGY_OUTPERFORMING'} type
 * @property {string} subject - The indicator/strategy/regime this recommendation targets.
 * @property {string} message
 * @property {'low'|'medium'|'high'} severity
 */

/**
 * The full output of a learning cycle, returned by
 * {@link import('./LearningEngine.js').LearningEngine#getLearningOutput}.
 * @typedef {Object} LearningOutput
 * @property {Object.<string, number>} updatedWeights - indicator name -> weight
 * @property {object} updatedConfidenceModel
 * @property {IndicatorPerformance[]} indicatorPerformance
 * @property {StrategyPerformance[]} strategyPerformance
 * @property {Recommendation[]} recommendations
 * @property {number} learningScore - 0..100
 * @property {CalibrationBucket[]} confidenceCalibration
 * @property {object} optimizationSummary
 */

export default {};
