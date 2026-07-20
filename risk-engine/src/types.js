/**
 * @file Shared JSDoc type definitions for the risk engine's public
 * contract. No runtime logic — pure documentation/typing, imported
 * by other files via `import('./types.js')` JSDoc references.
 * @module risk-engine/types
 */

/**
 * The decision payload this module expects from the Decision Engine
 * (Module 3), extended with the market/account context fields a risk
 * engine cannot function without. Module 4 does not compute indicators
 * or prices itself — `entryPrice`, `atr`, and `equity` must be supplied
 * by the caller (typically the same orchestrator that already has
 * Module 1's indicator output and the account's live equity).
 * @typedef {Object} DecisionInput
 * @property {string} symbol
 * @property {'LONG'|'SHORT'|'WAIT'|'EXIT'} decision
 * @property {number} confidence - 0..1
 * @property {string} marketState - e.g. 'trending', 'ranging', 'extreme_volatility', 'illiquid', 'news_event'.
 * @property {number} trendStrength - 0..1
 * @property {number} volatility - Fractional volatility measure (e.g. ATR/price), 0..1+.
 * @property {number} recommendedLeverage - Decision Engine's suggested leverage (this module may reduce it, never increase it).
 * @property {number} recommendedRisk - Decision Engine's suggested risk fraction of equity, 0..1.
 * @property {string[]} bullishSignals
 * @property {string[]} bearishSignals
 * @property {object} scoreBreakdown
 * @property {number} entryPrice - Current/intended entry price. Required for stop/target/size math.
 * @property {number} atr - Current ATR value in price units (already computed by Module 1). Required for stop/target math.
 * @property {number} equity - Current account equity in quote currency. Required for position sizing.
 * @property {'none'|'low'|'medium'|'high'} [newsRisk='none'] - Optional news-risk classification.
 */

/**
 * @typedef {Object} TakeProfitTarget
 * @property {number} price
 * @property {number} sizePct - Fraction of the position closed at this target, 0..1.
 * @property {number} rMultiple - This target's distance from entry, expressed in R (risk units).
 */

/**
 * The complete execution plan this module returns.
 * @typedef {Object} ExecutionPlan
 * @property {boolean} allowed
 * @property {string|null} rejectReason
 * @property {number} positionSize - Notional position size in quote currency.
 * @property {number} leverage
 * @property {number} stopLoss - Stop-loss price.
 * @property {number[]} takeProfit - Take-profit prices (see also `takeProfitTargets` for full detail).
 * @property {TakeProfitTarget[]} takeProfitTargets
 * @property {boolean} breakEven - Whether break-even stop management is enabled for this trade.
 * @property {boolean} trailingStop - Whether ATR trailing-stop management is enabled for this trade.
 * @property {number} riskScore - 0..100 composite risk score (higher = riskier).
 * @property {number} portfolioHeat - 0..100, current portfolio heat including this trade.
 * @property {number} maxLoss - Maximum loss for this trade as a percent of equity (e.g. 5 = 5%).
 * @property {number} estimatedLoss - Estimated loss in percent of equity if stopped out.
 * @property {number} estimatedProfit - Estimated profit in percent of equity if the final target is hit.
 * @property {number} rrRatio - Blended risk:reward ratio across all take-profit targets.
 */

/**
 * @typedef {Object} OpenPosition
 * @property {string} symbol
 * @property {number} notional - Position notional in quote currency.
 * @property {'LONG'|'SHORT'} side
 * @property {number} riskAmount - Dollar (quote-currency) amount at risk on this position (to stop-loss).
 */

/**
 * @typedef {Object} TradeResult
 * @property {string} symbol
 * @property {number} pnl - Realized profit/loss in quote currency (negative for a loss).
 * @property {number} pnlPct - Realized profit/loss as a fraction of equity at entry.
 * @property {number} timestamp
 */

export default {};
