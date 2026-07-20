/**
 * @file Position lifecycle management: open, close, partial close,
 * scale in/out, reverse, and emergency close — all built from
 * {@link OrderManager} primitives.
 * @module execution-engine/PositionManager
 */

/**
 * Orchestrates position-level operations. Holds no independent state
 * of its own for position size/side — it always asks the exchange
 * adapter for the current position before acting, so it can never
 * drift from exchange truth.
 */
export class PositionManager {
  /**
   * @param {Object} deps
   * @param {import('./ExchangeAdapter.js').ExchangeAdapter} deps.adapter
   * @param {import('./OrderManager.js').OrderManager} deps.orderManager
   * @param {import('./types.js').Logger} [deps.logger]
   */
  constructor({ adapter, orderManager, logger = null }) {
    /** @private */ this._adapter = adapter;
    /** @private */ this._orderManager = orderManager;
    /** @private */ this._logger = logger;
  }

  /**
   * Open a new position with a market entry order.
   * @param {string} symbol
   * @param {'LONG'|'SHORT'} side
   * @param {number} quantity
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async openPosition(symbol, side, quantity, context = {}) {
    const orderSide = side === 'LONG' ? 'BUY' : 'SELL';
    const order = this._orderManager.buildMarketOrder(symbol, orderSide, quantity, { reduceOnly: false });
    return this._orderManager.submitOrder(order, context);
  }

  /**
   * Fully close an existing position at market.
   * @param {string} symbol
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult|{success:true, status:'NO_OP', message:string}>}
   */
  async closePosition(symbol, context = {}) {
    const position = await this._adapter.getPosition(symbol);
    if (!position || position.quantity === 0) {
      return { success: true, status: 'NO_OP', message: `No open position on ${symbol} to close` };
    }
    const closingSide = position.side === 'LONG' ? 'SELL' : 'BUY';
    const order = this._orderManager.buildMarketOrder(symbol, closingSide, position.quantity, { reduceOnly: true });
    return this._orderManager.submitOrder(order, { ...context, existingPosition: position });
  }

  /**
   * Close a fraction of an existing position.
   * @param {string} symbol
   * @param {number} fraction - 0 < fraction <= 1.
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async partialClose(symbol, fraction, context = {}) {
    if (!(fraction > 0 && fraction <= 1)) {
      throw new Error('PositionManager.partialClose: fraction must be in (0, 1]');
    }
    const position = await this._adapter.getPosition(symbol);
    if (!position || position.quantity === 0) {
      return { success: true, status: 'NO_OP', message: `No open position on ${symbol} to partially close` };
    }
    const closingSide = position.side === 'LONG' ? 'SELL' : 'BUY';
    const quantity = position.quantity * fraction;
    const order = this._orderManager.buildMarketOrder(symbol, closingSide, quantity, { reduceOnly: true });
    return this._orderManager.submitOrder(order, { ...context, existingPosition: position });
  }

  /**
   * Add to an existing position in the same direction.
   * @param {string} symbol
   * @param {number} additionalQuantity
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async scaleIn(symbol, additionalQuantity, context = {}) {
    const position = await this._adapter.getPosition(symbol);
    if (!position) {
      throw new Error(`PositionManager.scaleIn: no existing position on ${symbol} to scale into`);
    }
    const orderSide = position.side === 'LONG' ? 'BUY' : 'SELL';
    const order = this._orderManager.buildMarketOrder(symbol, orderSide, additionalQuantity, { reduceOnly: false });
    return this._orderManager.submitOrder(order, { ...context, existingPosition: position });
  }

  /**
   * Reduce an existing position without fully closing it.
   * @param {string} symbol
   * @param {number} reduceQuantity
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async scaleOut(symbol, reduceQuantity, context = {}) {
    const position = await this._adapter.getPosition(symbol);
    if (!position || position.quantity === 0) {
      return { success: true, status: 'NO_OP', message: `No open position on ${symbol} to scale out of` };
    }
    const quantity = Math.min(reduceQuantity, position.quantity);
    const closingSide = position.side === 'LONG' ? 'SELL' : 'BUY';
    const order = this._orderManager.buildMarketOrder(symbol, closingSide, quantity, { reduceOnly: true });
    return this._orderManager.submitOrder(order, { ...context, existingPosition: position });
  }

  /**
   * Close the existing position and open a new one in the opposite
   * direction. Executed as two sequential orders (close, then open) —
   * NOT Binance's single "hedge mode" flip — so each leg is
   * independently validated and tracked.
   * @param {string} symbol
   * @param {number} newQuantity
   * @param {Object} [context]
   * @returns {Promise<{closeResult:import('./types.js').OrderResult, openResult:import('./types.js').OrderResult|null}>}
   */
  async reversePosition(symbol, newQuantity, context = {}) {
    const position = await this._adapter.getPosition(symbol);
    if (!position || position.quantity === 0) {
      throw new Error(`PositionManager.reversePosition: no existing position on ${symbol} to reverse`);
    }
    const closeResult = await this.closePosition(symbol, context);
    if (!closeResult.success) {
      return { closeResult, openResult: null };
    }
    const newSide = position.side === 'LONG' ? 'SHORT' : 'LONG';
    const openResult = await this.openPosition(symbol, newSide, newQuantity, context);
    return { closeResult, openResult };
  }

  /**
   * Immediately close a position at market, bypassing normal
   * reduceOnly-quantity reconciliation subtleties by using
   * `closePosition: true` semantics at the order layer — used when a
   * human/KillSwitch-triggered emergency requires the fastest
   * possible flatten, independent of precise tracked quantity.
   * @param {string} symbol
   * @param {Object} [context]
   * @returns {Promise<import('./types.js').OrderResult|{success:true, status:'NO_OP', message:string}>}
   */
  async emergencyClose(symbol, context = {}) {
    const position = await this._adapter.getPosition(symbol);
    if (!position || position.quantity === 0) {
      return { success: true, status: 'NO_OP', message: `No open position on ${symbol} to emergency-close` };
    }
    const closingSide = position.side === 'LONG' ? 'SELL' : 'BUY';
    const order = {
      ...this._orderManager.buildMarketOrder(symbol, closingSide, position.quantity, { reduceOnly: true }),
      closePosition: true,
    };
    this._logger?.critical?.(`Emergency close triggered for ${symbol}`);
    return this._orderManager.submitOrder(order, { ...context, existingPosition: position });
  }
}

export default PositionManager;
