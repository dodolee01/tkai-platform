/**
 * TK AI Finance - Module 3: AI Decision Engine
 * Shared JSDoc type definitions.
 *
 * This file exists purely for editor/IDE intellisense and documentation.
 * It has no runtime behaviour.
 */

/**
 * @typedef {Object} MacdSnapshot
 * @property {number} macd
 * @property {number} signal
 * @property {number} histogram
 */

/**
 * @typedef {Object} BollingerSnapshot
 * @property {number} upper
 * @property {number} middle
 * @property {number} lower
 */

/**
 * @typedef {Object} SupertrendSnapshot
 * @property {number} value
 * @property {(number|string)} direction  1/-1 or 'up'/'down'/'bullish'/'bearish'
 */

/**
 * @typedef {Object} IchimokuSnapshot
 * @property {number} tenkan
 * @property {number} kijun
 * @property {number} senkouA
 * @property {number} senkouB
 * @property {number} [chikou]
 */

/**
 * @typedef {Object} StochasticSnapshot
 * @property {number} k
 * @property {number} d
 */

/**
 * @typedef {Object} OrderBookSnapshot
 * @property {number} [imbalance]     Precomputed (bidVol - askVol) / (bidVol + askVol), range -1..1
 * @property {number} [bidVolume]
 * @property {number} [askVolume]
 * @property {number} [spread]
 */

/**
 * @typedef {Object} VolumeProfileSnapshot
 * @property {number} poc              Point of control price
 * @property {number} valueAreaHigh
 * @property {number} valueAreaLow
 */

/**
 * @typedef {Object} PivotSnapshot
 * @property {number} pivot
 * @property {number} r1
 * @property {number} [r2]
 * @property {number} [r3]
 * @property {number} s1
 * @property {number} [s2]
 * @property {number} [s3]
 */

/**
 * @typedef {Object} OpenInterestSnapshot
 * @property {number} value
 * @property {number} [change24h]
 */

/**
 * @typedef {Object} LiquidationSnapshot
 * @property {number} [longLiquidations]
 * @property {number} [shortLiquidations]
 * @property {number} [totalVolume]
 */

/**
 * @typedef {Object} MarketSnapshot
 * @property {string} symbol
 * @property {string} timeframe
 * @property {number} price
 * @property {number} [ema20]
 * @property {number} [ema50]
 * @property {number} [ema200]
 * @property {number} [rsi]
 * @property {MacdSnapshot} [macd]
 * @property {number} [atr]
 * @property {number} [adx]
 * @property {SupertrendSnapshot} [supertrend]
 * @property {BollingerSnapshot} [bollinger]
 * @property {IchimokuSnapshot} [ichimoku]
 * @property {StochasticSnapshot} [stochastic]
 * @property {number} [mfi]
 * @property {number} [vwap]
 * @property {number} [obv]
 * @property {number} [cmf]
 * @property {number} [cci]
 * @property {number} [williamsR]
 * @property {(number|{rate:number,predictedRate?:number})} [funding]
 * @property {OpenInterestSnapshot} [openInterest]
 * @property {LiquidationSnapshot} [liquidation]
 * @property {OrderBookSnapshot} [orderBook]
 * @property {number} [delta]
 * @property {VolumeProfileSnapshot} [volumeProfile]
 * @property {PivotSnapshot} [pivot]
 */

/**
 * @typedef {'BULLISH'|'BEARISH'|'NEUTRAL'} SignalDirection
 */

/**
 * @typedef {Object} Signal
 * @property {string} indicator
 * @property {string} category
 * @property {SignalDirection} signal
 * @property {number} strength   0..1
 * @property {number} weight
 * @property {string} reason
 */

/**
 * @typedef {'LONG'|'SHORT'|'WAIT'|'EXIT'} Decision
 */

/**
 * @typedef {'TRENDING'|'RANGING'|'BREAKOUT'|'REVERSAL'|'HIGH_VOLATILITY'|'LOW_VOLATILITY'|'NEWS_RISK'} MarketStateName
 */

/**
 * @typedef {'LOW'|'MEDIUM'|'HIGH'} RiskLevel
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} trend
 * @property {number} momentum
 * @property {number} volatility
 * @property {number} orderflow
 * @property {number} total
 */

/**
 * @typedef {Object} DecisionResult
 * @property {Decision} decision
 * @property {number} confidence
 * @property {MarketStateName} marketState
 * @property {number} trendStrength
 * @property {RiskLevel} volatility
 * @property {RiskLevel} riskLevel
 * @property {number} recommendedLeverage
 * @property {number} recommendedRisk
 * @property {string[]} bullishSignals
 * @property {string[]} bearishSignals
 * @property {ScoreBreakdown} scoreBreakdown
 * @property {string[]} reasons
 */

export {};
