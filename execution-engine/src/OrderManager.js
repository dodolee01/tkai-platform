/**
 * @file Builds order requests for every supported order type and
 * submits them through the full safety pipeline (validation, rate
 * limiting, retry, tracking).
 * @module execution-engine/OrderManager
 */

import { randomUUID } from 'node:crypto';
import { OrderStatus } from './OrderTracker.js';
import { classifyError } from './ErrorHandler.js';

/**
 * @returns {string}
 * @private
 */
function generateClientOrderId() {
  return `tkai_${randomUUID()}`;
}

/**
 * Builds well-formed {@link import('./types.js').OrderRequest} objects
 * for every supported order type, and submits them through
 * validation -> rate limiting -> retry -> exchange -> tracking.
 */
export class OrderManager {
  /**
   * @param {Object} deps
   * @param {import('./ExchangeAdapter.js').ExchangeAdapter} deps.adapter
   * @param {import('./OrderTracker.js').OrderTracker} deps.orderTracker
   * @param {import('./OrderValidator.js').OrderValidator} deps.validator
   * @param {import('./RetryManager.js').RetryManager} deps.retryManager
   * @param {import('./RateLimiter.js').RateLimiter} deps.rateLimiter
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - Full execution-engine config (uses `dryRun`).
   */
  constructor({ adapter, orderTracker, validator, retryManager, rateLimiter, logger = null }, config) {
    /** @private */ this._adapter = adapter;
    /** @private */ this._orderTracker = orderTracker;
    /** @private */ this._validator = validator;
    /** @private */ this._retryManager = retryManager;
    /** @private */ this._rateLimiter = rateLimiter;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
  }

  /** @param {string} symbol @param {'BUY'|'SELL'} side @param {number} quantity @returns {import('./types.js').OrderRequest} */
  buildMarketOrder(symbol, side, quantity, { reduceOnly = false } = {}) {
    return { symbol, side, type: 'MARKET', quantity, reduceOnly, clientOrderId: generateClientOrderId() };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildLimitOrder(symbol, side, quantity, price, { reduceOnly = false, postOnly = false, timeInForce } = {}) {
    return {
      symbol,
      side,
      type: 'LIMIT',
      quantity,
      price,
      timeInForce: postOnly ? 'GTX' : timeInForce ?? 'GTC',
      reduceOnly,
      clientOrderId: generateClientOrderId(),
    };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildStopMarketOrder(symbol, side, quantity, stopPrice, { reduceOnly = true, closePosition = false } = {}) {
    return { symbol, side, type: 'STOP_MARKET', quantity, stopPrice, reduceOnly, closePosition, clientOrderId: generateClientOrderId() };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildStopLimitOrder(symbol, side, quantity, stopPrice, price, { reduceOnly = true, timeInForce = 'GTC' } = {}) {
    return { symbol, side, type: 'STOP', quantity, price, stopPrice, timeInForce, reduceOnly, clientOrderId: generateClientOrderId() };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildTakeProfitMarketOrder(symbol, side, quantity, stopPrice, { reduceOnly = true, closePosition = false } = {}) {
    return { symbol, side, type: 'TAKE_PROFIT_MARKET', quantity, stopPrice, reduceOnly, closePosition, clientOrderId: generateClientOrderId() };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildTakeProfitLimitOrder(symbol, side, quantity, stopPrice, price, { reduceOnly = true, timeInForce = 'GTC' } = {}) {
    return { symbol, side, type: 'TAKE_PROFIT', quantity, price, stopPrice, timeInForce, reduceOnly, clientOrderId: generateClientOrderId() };
  }

  /** @returns {import('./types.js').OrderRequest} */
  buildTrailingStopOrder(symbol, side, quantity, callbackRate, { reduceOnly = true } = {}) {
    return { symbol, side, type: 'TRAILING_STOP_MARKET', quantity, callbackRate, reduceOnly, clientOrderId: generateClientOrderId() };
  }

  /**
   * Apply IOC/FOK time-in-force to an already-built LIMIT-family order.
   * @param {import('./types.js').OrderRequest} order
   * @param {'IOC'|'FOK'} timeInForce
   * @returns {import('./types.js').OrderRequest}
   */
  withTimeInForce(order, timeInForce) {
    return { ...order, timeInForce };
  }

  /**
   * Validate, rate-limit, and submit an order through the exchange
   * adapter with retry protection, recording every state transition.
   * @param {import('./types.js').OrderRequest} order
   * @param {Object} [context] - Passed through to {@link OrderValidator#validate}.
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async submitOrder(order, context = {}) {
    const startedAt = Date.now();

    const validation = await this._validator.validate(order, context);
    if (!validation.valid) {
      return this._buildResult({
        success: false,
        status: OrderStatus.REJECTED,
        clientOrderId: order.clientOrderId,
        rejectReason: validation.errors.join('; '),
        startedAt,
      });
    }
    const normalizedOrder = validation.normalizedOrder;

    this._orderTracker.createPending(normalizedOrder);

    if (this._config.dryRun) {
      // SAFETY: dry-run mode validates and tracks the order fully but
      // never calls the exchange adapter. This is the default mode —
      // see Config.js and the README.
      this._orderTracker.updateStatus(normalizedOrder.clientOrderId, OrderStatus.ACCEPTED, {});
      this._orderTracker.updateStatus(normalizedOrder.clientOrderId, OrderStatus.FILLED, {
        executionPrice: normalizedOrder.price ?? normalizedOrder.stopPrice ?? context.estimatedReferencePrice ?? 0,
        filledQuantity: normalizedOrder.quantity,
      });
      return this._buildResult({
        success: true,
        status: OrderStatus.FILLED,
        clientOrderId: normalizedOrder.clientOrderId,
        orderId: `dry_${normalizedOrder.clientOrderId}`,
        executionPrice: normalizedOrder.price ?? normalizedOrder.stopPrice ?? context.estimatedReferencePrice ?? 0,
        quantity: normalizedOrder.quantity,
        fees: 0,
        startedAt,
      });
    }

    await this._rateLimiter.acquire();

    const retryResult = await this._retryManager.execute(() => this._adapter.placeOrder(normalizedOrder));

    if (!retryResult.success) {
      this._orderTracker.updateStatus(normalizedOrder.clientOrderId, OrderStatus.REJECTED, {});
      this._logger?.error?.(`Order submission failed for ${normalizedOrder.clientOrderId}`, retryResult.error);
      return this._buildResult({
        success: false,
        status: OrderStatus.REJECTED,
        clientOrderId: normalizedOrder.clientOrderId,
        rejectReason: retryResult.error.message,
        errorDetail: retryResult.error,
        startedAt,
      });
    }

    const exchangeResult = retryResult.result;
    this._orderTracker.updateStatus(normalizedOrder.clientOrderId, OrderStatus.ACCEPTED, { orderId: exchangeResult.orderId });

    const finalStatus = this._mapExchangeStatus(exchangeResult.status);
    if (finalStatus !== OrderStatus.ACCEPTED) {
      this._orderTracker.updateStatus(normalizedOrder.clientOrderId, finalStatus, {
        executionPrice: exchangeResult.executionPrice,
        filledQuantity: exchangeResult.quantity,
      });
    }

    return this._buildResult({
      success: true,
      status: finalStatus,
      clientOrderId: normalizedOrder.clientOrderId,
      orderId: exchangeResult.orderId,
      executionPrice: exchangeResult.executionPrice,
      quantity: exchangeResult.quantity,
      fees: exchangeResult.fees,
      startedAt,
    });
  }

  /**
   * @param {string} exchangeStatus
   * @returns {string}
   * @private
   */
  _mapExchangeStatus(exchangeStatus) {
    const map = {
      NEW: OrderStatus.ACCEPTED,
      PARTIALLY_FILLED: OrderStatus.PARTIALLY_FILLED,
      FILLED: OrderStatus.FILLED,
      CANCELED: OrderStatus.CANCELLED,
      EXPIRED: OrderStatus.EXPIRED,
      REJECTED: OrderStatus.REJECTED,
    };
    return map[exchangeStatus] ?? OrderStatus.ACCEPTED;
  }

  /**
   * @param {Object} fields
   * @returns {import('./types.js').OrderResult}
   * @private
   */
  _buildResult({ success, status, clientOrderId, orderId = null, executionPrice = null, quantity = null, fees = null, rejectReason, errorDetail, startedAt }) {
    const result = {
      success,
      orderId,
      clientOrderId,
      executionPrice,
      quantity,
      fees,
      status,
      exchange: this._adapter.exchangeName,
      latency: Date.now() - startedAt,
      timestamp: Date.now(),
    };
    if (rejectReason) result.rejectReason = rejectReason;
    if (errorDetail) result.errorDetail = errorDetail;
    return result;
  }

  /**
   * @param {string} symbol
   * @param {string} orderId
   * @returns {Promise<{orderId:string, status:string}>}
   */
  async cancelOrder(symbol, orderId) {
    if (this._config.dryRun) {
      return { orderId, status: OrderStatus.CANCELLED };
    }
    await this._rateLimiter.acquire();
    const retryResult = await this._retryManager.execute(() => this._adapter.cancelOrder(symbol, orderId));
    if (!retryResult.success) {
      throw new Error(`Failed to cancel order ${orderId}: ${retryResult.error.message}`);
    }
    return retryResult.result;
  }
}

export default OrderManager;
