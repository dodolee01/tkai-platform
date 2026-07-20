/**
 * @file Shared JSDoc type definitions for the execution engine's
 * public contract. No runtime logic.
 * @module execution-engine/types
 */

/**
 * The approved execution plan this module accepts, as produced by
 * the Risk Engine (Module 4). If `allowed` is false, the Execution
 * Engine does nothing — see {@link import('./ExecutionEngine.js').ExecutionEngine#execute}.
 * `takeProfit` may be a single price (per the Module 6 prompt's
 * minimal example) or an array of `{price, sizePct}` targets (the
 * Risk Engine's actual richer output) — both are handled; see the
 * README integration notes.
 * @typedef {Object} ApprovedExecutionPlan
 * @property {string} symbol
 * @property {'LONG'|'SHORT'} side
 * @property {number} positionSize - Notional size in quote currency.
 * @property {number} leverage
 * @property {number} stopLoss
 * @property {number|Array<{price:number, sizePct:number}>} takeProfit
 * @property {boolean} breakEven
 * @property {boolean} trailingStop
 * @property {boolean} allowed
 */

/**
 * @typedef {Object} SymbolInfo
 * @property {string} symbol
 * @property {number} tickSize
 * @property {number} stepSize
 * @property {number} minQty
 * @property {number} maxQty
 * @property {number} minNotional
 * @property {number} pricePrecision
 * @property {number} quantityPrecision
 * @property {number} maxLeverage
 * @property {'TRADING'|'BREAK'|'HALT'|string} status
 */

/**
 * @typedef {Object} OrderRequest
 * @property {string} symbol
 * @property {'BUY'|'SELL'} side
 * @property {'MARKET'|'LIMIT'|'STOP_MARKET'|'STOP'|'TAKE_PROFIT_MARKET'|'TAKE_PROFIT'|'TRAILING_STOP_MARKET'} type
 * @property {number} quantity
 * @property {number} [price] - Required for LIMIT/STOP/TAKE_PROFIT.
 * @property {number} [stopPrice] - Required for STOP*/TAKE_PROFIT* types.
 * @property {number} [callbackRate] - Required for TRAILING_STOP_MARKET (percent).
 * @property {'GTC'|'IOC'|'FOK'|'GTX'} [timeInForce] - GTX = post-only on Binance.
 * @property {boolean} [reduceOnly]
 * @property {boolean} [closePosition]
 * @property {string} clientOrderId
 */

/**
 * @typedef {Object} OrderResult
 * @property {boolean} success
 * @property {string|null} orderId
 * @property {string|null} clientOrderId
 * @property {number|null} executionPrice
 * @property {number|null} quantity
 * @property {number|null} fees
 * @property {'PENDING'|'ACCEPTED'|'REJECTED'|'FILLED'|'CANCELLED'|'EXPIRED'|'PARTIALLY_FILLED'|'NO_OP'|'ERROR'} status
 * @property {string} exchange
 * @property {number} latency - Milliseconds elapsed placing the order.
 * @property {number} timestamp
 * @property {string} [rejectReason]
 * @property {object} [errorDetail]
 */

/**
 * @typedef {Object} Position
 * @property {string} symbol
 * @property {'LONG'|'SHORT'|'FLAT'} side
 * @property {number} quantity
 * @property {number} entryPrice
 * @property {number} leverage
 * @property {number} unrealizedPnl
 * @property {string|null} stopOrderId
 * @property {string[]} takeProfitOrderIds
 */

export default {};
