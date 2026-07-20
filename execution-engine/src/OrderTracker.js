/**
 * @file Order state-machine tracking: PENDING -> ACCEPTED -> FILLED /
 * PARTIALLY_FILLED -> ... -> CANCELLED / REJECTED / EXPIRED.
 * @module execution-engine/OrderTracker
 */

/**
 * @enum {string}
 */
export const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
});

/**
 * Valid status transitions. A transition not listed here is rejected
 * by {@link OrderTracker#updateStatus} — this prevents, for example,
 * a stale/duplicate exchange callback from resurrecting an order that
 * has already reached a terminal state.
 * @type {Object.<string, string[]>}
 */
const VALID_TRANSITIONS = Object.freeze({
  [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
  [OrderStatus.ACCEPTED]: [OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED, OrderStatus.CANCELLED, OrderStatus.EXPIRED, OrderStatus.REJECTED],
  [OrderStatus.PARTIALLY_FILLED]: [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.EXPIRED],
  [OrderStatus.FILLED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.EXPIRED]: [],
});

/**
 * @typedef {Object} TrackedOrder
 * @property {string} clientOrderId
 * @property {string|null} orderId
 * @property {string} symbol
 * @property {string} status
 * @property {import('./types.js').OrderRequest} request
 * @property {number|null} executionPrice
 * @property {number} filledQuantity
 * @property {number[]} statusHistory
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * In-memory order state tracker.
 */
export class OrderTracker {
  constructor() {
    /** @private @type {Map<string, TrackedOrder>} */
    this._orders = new Map();
  }

  /**
   * Register a new order in PENDING state.
   * @param {import('./types.js').OrderRequest} request
   * @returns {TrackedOrder}
   */
  createPending(request) {
    const now = Date.now();
    const order = {
      clientOrderId: request.clientOrderId,
      orderId: null,
      symbol: request.symbol,
      status: OrderStatus.PENDING,
      request,
      executionPrice: null,
      filledQuantity: 0,
      statusHistory: [{ status: OrderStatus.PENDING, at: now }],
      createdAt: now,
      updatedAt: now,
    };
    this._orders.set(request.clientOrderId, order);
    return order;
  }

  /**
   * Transition an order to a new status. Throws if the transition
   * isn't valid from the order's current state.
   * @param {string} clientOrderId
   * @param {string} newStatus
   * @param {Object} [details]
   * @param {string} [details.orderId]
   * @param {number} [details.executionPrice]
   * @param {number} [details.filledQuantity]
   * @returns {TrackedOrder}
   */
  updateStatus(clientOrderId, newStatus, details = {}) {
    const order = this._orders.get(clientOrderId);
    if (!order) {
      throw new Error(`OrderTracker.updateStatus: unknown clientOrderId "${clientOrderId}"`);
    }
    const allowedNext = VALID_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new Error(
        `OrderTracker.updateStatus: invalid transition "${order.status}" -> "${newStatus}" for order ${clientOrderId}`
      );
    }

    order.status = newStatus;
    if (details.orderId !== undefined) order.orderId = details.orderId;
    if (details.executionPrice !== undefined) order.executionPrice = details.executionPrice;
    if (details.filledQuantity !== undefined) order.filledQuantity = details.filledQuantity;
    order.updatedAt = Date.now();
    order.statusHistory.push({ status: newStatus, at: order.updatedAt });

    return order;
  }

  /**
   * @param {string} clientOrderId
   * @returns {TrackedOrder|undefined}
   */
  get(clientOrderId) {
    return this._orders.get(clientOrderId);
  }

  /**
   * @param {string} symbol
   * @returns {TrackedOrder[]}
   */
  getBySymbol(symbol) {
    return Array.from(this._orders.values()).filter((o) => o.symbol === symbol);
  }

  /**
   * @param {string} symbol
   * @returns {TrackedOrder[]} Orders for a symbol that are not yet in a terminal state.
   */
  getActiveBySymbol(symbol) {
    const terminal = new Set([OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.EXPIRED]);
    return this.getBySymbol(symbol).filter((o) => !terminal.has(o.status));
  }

  /**
   * @returns {TrackedOrder[]}
   */
  getAll() {
    return Array.from(this._orders.values());
  }
}

export default { OrderTracker, OrderStatus };
