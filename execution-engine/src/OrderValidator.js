/**
 * @file Pre-flight order validation: every check the prompt requires
 * runs here before any order reaches the exchange adapter.
 * @module execution-engine/OrderValidator
 */

import {
  roundToTickSize,
  roundToStepSize,
  meetsMinNotional,
  withinQtyBounds,
  isAlignedToStep,
} from './Precision.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {import('./types.js').OrderRequest|null} normalizedOrder - The order with price/quantity rounded to valid precision, if valid.
 */

/**
 * Validates an order request against exchange symbol rules, account
 * balance, and internal execution-safety state, before it is ever
 * sent to {@link ExchangeAdapter#placeOrder}.
 */
export class OrderValidator {
  /**
   * @param {Object} deps
   * @param {import('./ExchangeAdapter.js').ExchangeAdapter} deps.adapter
   * @param {import('./DuplicateProtection.js').DuplicateProtection} deps.duplicateProtection
   * @param {import('./OrderTracker.js').OrderTracker} deps.orderTracker
   * @param {object} config - `config.validation` section.
   */
  constructor({ adapter, duplicateProtection, orderTracker }, config) {
    /** @private */ this._adapter = adapter;
    /** @private */ this._duplicateProtection = duplicateProtection;
    /** @private */ this._orderTracker = orderTracker;
    /** @private */ this._config = config;
  }

  /**
   * @param {import('./types.js').OrderRequest} order
   * @param {Object} [context]
   * @param {import('./types.js').Position|null} [context.existingPosition]
   * @param {number} [context.estimatedReferencePrice] - Used for MARKET orders, which carry no `price`, to check notional/margin.
   * @returns {Promise<ValidationResult>}
   */
  async validate(order, context = {}) {
    const errors = [];

    // 1. Duplicate order check (idempotency / in-flight lock is handled
    //    at the ExecutionEngine/DuplicateProtection layer before this
    //    point is even reached; here we additionally guard against the
    //    same clientOrderId being tracked already).
    if (this._orderTracker.get(order.clientOrderId)) {
      errors.push('duplicate_order: clientOrderId already tracked');
    }

    // 2. Symbol exists + market open.
    let symbolInfo;
    try {
      symbolInfo = await this._adapter.getSymbolInfo(order.symbol);
    } catch {
      errors.push('symbol_not_found');
      return { valid: false, errors, normalizedOrder: null };
    }
    if (symbolInfo.status !== 'TRADING') {
      errors.push(`market_not_open: status is ${symbolInfo.status}`);
    }

    // 3. Precision: round price/quantity to valid tick/step size.
    const normalizedOrder = { ...order };
    if (order.price !== undefined) {
      normalizedOrder.price = roundToTickSize(order.price, symbolInfo.tickSize);
      if (!isAlignedToStep(normalizedOrder.price, symbolInfo.tickSize)) {
        errors.push('invalid_tick_size');
      }
    }
    if (order.stopPrice !== undefined) {
      normalizedOrder.stopPrice = roundToTickSize(order.stopPrice, symbolInfo.tickSize);
    }
    normalizedOrder.quantity = roundToStepSize(order.quantity, symbolInfo.stepSize);
    if (!isAlignedToStep(normalizedOrder.quantity, symbolInfo.stepSize)) {
      errors.push('invalid_lot_size');
    }

    // 4. Quantity bounds.
    if (!withinQtyBounds(normalizedOrder.quantity, symbolInfo.minQty, symbolInfo.maxQty)) {
      errors.push(`quantity_out_of_bounds: ${normalizedOrder.quantity} not in [${symbolInfo.minQty}, ${symbolInfo.maxQty}]`);
    }
    if (normalizedOrder.quantity <= 0) {
      errors.push('invalid_quantity: quantity rounds to zero at this precision');
    }

    // 5. Minimum notional.
    const referencePrice = normalizedOrder.price ?? normalizedOrder.stopPrice ?? context.estimatedReferencePrice;
    if (referencePrice !== undefined) {
      const effectiveMinNotional = Math.max(symbolInfo.minNotional, this._config.minNotionalUsd);
      if (!meetsMinNotional(referencePrice, normalizedOrder.quantity, effectiveMinNotional)) {
        errors.push(`below_minimum_notional: required >= ${effectiveMinNotional}`);
      }
    }

    // 6. ReduceOnly rules: a reduceOnly order must not exceed the
    //    existing position's size, and cannot be placed with no
    //    existing position to reduce.
    if (normalizedOrder.reduceOnly) {
      if (!context.existingPosition || context.existingPosition.quantity === 0) {
        errors.push('reduce_only_without_position');
      } else if (normalizedOrder.quantity > context.existingPosition.quantity) {
        errors.push('reduce_only_exceeds_position_size');
      }
    }

    // 7. Margin / balance available (only meaningfully checkable for
    //    orders that increase exposure, i.e. not reduceOnly).
    if (!normalizedOrder.reduceOnly && referencePrice !== undefined) {
      try {
        const balances = await this._adapter.getBalance();
        const quoteAsset = order.symbol.endsWith('USDT') ? 'USDT' : order.symbol.slice(-4);
        const balance = balances.find((b) => b.asset === quoteAsset);
        const requiredMargin = (referencePrice * normalizedOrder.quantity) / (context.leverage || 1);
        if (!balance || balance.available < requiredMargin) {
          errors.push('insufficient_margin');
        }
      } catch {
        errors.push('balance_check_failed');
      }
    }

    return { valid: errors.length === 0, errors, normalizedOrder: errors.length === 0 ? normalizedOrder : null };
  }
}

export default OrderValidator;
