/**
 * @file The execution engine orchestrator. Receives ONLY approved
 * execution plans from the Risk Engine and turns them into exchange
 * orders through the full safety pipeline: kill switch -> duplicate
 * protection -> per-symbol queue -> leverage -> entry order -> stop
 * loss / take profit orders. This is the module's sole public
 * integration point.
 * @module execution-engine/ExecutionEngine
 */

import { createConfig } from './Config.js';
import { OrderTracker } from './OrderTracker.js';
import { OrderValidator } from './OrderValidator.js';
import { OrderManager } from './OrderManager.js';
import { PositionManager } from './PositionManager.js';
import { LeverageManager } from './LeverageManager.js';
import { ExecutionQueue } from './ExecutionQueue.js';
import { RetryManager } from './RetryManager.js';
import { DuplicateProtection, computeIdempotencyKey } from './DuplicateProtection.js';
import { RateLimiter } from './RateLimiter.js';
import { KillSwitch } from './KillSwitch.js';
import { classifyError } from './ErrorHandler.js';

/**
 * The institutional execution engine.
 *
 * **This module never decides whether to trade** — it only carries
 * out execution plans the Risk Engine has already approved. If
 * `plan.allowed !== true`, {@link ExecutionEngine#execute} does
 * absolutely nothing and returns immediately, per the Module 6 contract.
 */
export class ExecutionEngine {
  /**
   * @param {Object} deps
   * @param {import('./ExchangeAdapter.js').ExchangeAdapter} deps.adapter - Concrete adapter (e.g. {@link import('./BinanceAdapter.js').BinanceAdapter}).
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js. `dryRun` defaults to `true`.
   */
  constructor({ adapter, logger = null }, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._adapter = adapter;
    /** @private */ this._logger = logger;

    /** @type {OrderTracker} */
    this.orderTracker = new OrderTracker();
    /** @type {DuplicateProtection} */
    this.duplicateProtection = new DuplicateProtection(this.config.duplicateProtection);
    /** @type {RateLimiter} */
    this.rateLimiter = new RateLimiter(this.config.rateLimiter);
    /** @type {RetryManager} */
    this.retryManager = new RetryManager(this.config.retry);
    /** @type {ExecutionQueue} */
    this.executionQueue = new ExecutionQueue(this.config.queue);
    /** @type {KillSwitch} */
    this.killSwitch = new KillSwitch(this.config.killSwitch, logger);

    /** @type {OrderValidator} */
    this.orderValidator = new OrderValidator(
      { adapter, duplicateProtection: this.duplicateProtection, orderTracker: this.orderTracker },
      this.config.validation
    );
    /** @type {OrderManager} */
    this.orderManager = new OrderManager(
      { adapter, orderTracker: this.orderTracker, validator: this.orderValidator, retryManager: this.retryManager, rateLimiter: this.rateLimiter, logger },
      this.config
    );
    /** @type {PositionManager} */
    this.positionManager = new PositionManager({ adapter, orderManager: this.orderManager, logger });
    /** @type {LeverageManager} */
    this.leverageManager = new LeverageManager({ adapter, logger }, this.config.leverage);
  }

  /**
   * Execute an approved plan from the Risk Engine. If `plan.allowed`
   * is not exactly `true`, this does nothing and returns a `NO_OP`
   * result — no orders, no leverage changes, nothing sent to the
   * exchange.
   * @param {import('./types.js').ApprovedExecutionPlan} plan
   * @returns {Promise<import('./types.js').OrderResult>}
   */
  async execute(plan) {
    if (plan.allowed !== true) {
      return this._noOpResult('plan_not_allowed');
    }

    if (this.killSwitch.isEngaged()) {
      return this._noOpResult(`kill_switch_engaged: ${this.killSwitch.getStatus().reason}`);
    }

    const idempotencyKey = computeIdempotencyKey(plan);
    if (!this.duplicateProtection.claim(idempotencyKey)) {
      return this._noOpResult('duplicate_plan_within_idempotency_window');
    }

    return this.executionQueue.enqueue(plan.symbol, () => this._executeLocked(plan));
  }

  /**
   * Runs inside the per-symbol execution queue slot — the actual
   * multi-step execution: validate leverage, apply it, place the
   * entry order, then place stop-loss and take-profit order(s).
   * @param {import('./types.js').ApprovedExecutionPlan} plan
   * @returns {Promise<import('./types.js').OrderResult>}
   * @private
   */
  async _executeLocked(plan) {
    const startedAt = Date.now();
    try {
      const symbolInfo = await this._adapter.getSymbolInfo(plan.symbol);

      const leverageResult = await this.leverageManager.changeLeverage(plan.symbol, plan.leverage, symbolInfo);
      if (!leverageResult.success) {
        return this._noOpResult(`leverage_rejected: ${leverageResult.reason}`, startedAt);
      }

      const entryPrice = this._estimateEntryPrice(plan);
      const quantity = plan.positionSize / entryPrice;

      const entryResult = await this.positionManager.openPosition(plan.symbol, plan.side, quantity, {
        leverage: plan.leverage,
        estimatedReferencePrice: entryPrice,
      });

      if (!entryResult.success) {
        this.killSwitch.recordError(`entry order failed for ${plan.symbol}: ${entryResult.rejectReason}`);
        return entryResult;
      }
      this.killSwitch.recordSuccess();

      await this._placeProtectiveOrders(plan, quantity, entryPrice);

      return entryResult;
    } catch (err) {
      const classified = classifyError(err);
      this.killSwitch.recordError(`unexpected execution error for ${plan.symbol}: ${classified.message}`);
      this._logger?.error?.(`Execution failed for ${plan.symbol}`, classified);
      return {
        success: false,
        orderId: null,
        clientOrderId: null,
        executionPrice: null,
        quantity: null,
        fees: null,
        status: 'ERROR',
        exchange: this._adapter.exchangeName,
        latency: Date.now() - startedAt,
        timestamp: Date.now(),
        rejectReason: classified.message,
        errorDetail: classified,
      };
    }
  }

  /**
   * Place the stop-loss order and take-profit order(s) for a freshly
   * opened position. Failures here are logged but do not roll back
   * the already-filled entry — an open position with a missing
   * protective order is exactly the scenario that must be surfaced
   * loudly, not silently retried into a duplicate.
   * @param {import('./types.js').ApprovedExecutionPlan} plan
   * @param {number} quantity
   * @param {number} entryPrice
   * @returns {Promise<void>}
   * @private
   */
  async _placeProtectiveOrders(plan, quantity, entryPrice) {
    const exitSide = plan.side === 'LONG' ? 'SELL' : 'BUY';
    // The entry order just filled, so the position now on the books
    // has exactly this quantity/side — construct it here rather than
    // re-querying the exchange, since in dryRun mode there is no real
    // position to query, and querying live would introduce a race
    // against the exchange's own position-update latency.
    const existingPosition = { symbol: plan.symbol, side: plan.side, quantity, entryPrice, leverage: plan.leverage, unrealizedPnl: 0 };

    if (plan.stopLoss) {
      const stopOrder = this.orderManager.buildStopMarketOrder(plan.symbol, exitSide, quantity, plan.stopLoss);
      const result = await this.orderManager.submitOrder(stopOrder, {
        leverage: plan.leverage,
        estimatedReferencePrice: plan.stopLoss,
        existingPosition,
      });
      if (!result.success) {
        this._logger?.error?.(`Stop-loss order failed for ${plan.symbol}: ${result.rejectReason}`);
        this.killSwitch.recordError(`stop-loss placement failed for ${plan.symbol}`);
      }
    }

    const targets = this._normalizeTakeProfitTargets(plan.takeProfit, quantity);
    for (const target of targets) {
      const tpOrder = this.orderManager.buildTakeProfitMarketOrder(plan.symbol, exitSide, target.quantity, target.price);
      const result = await this.orderManager.submitOrder(tpOrder, {
        leverage: plan.leverage,
        estimatedReferencePrice: target.price,
        existingPosition,
      });
      if (!result.success) {
        this._logger?.error?.(`Take-profit order failed for ${plan.symbol} at ${target.price}: ${result.rejectReason}`);
        this.killSwitch.recordError(`take-profit placement failed for ${plan.symbol}`);
      }
    }
  }

  /**
   * Normalize `plan.takeProfit` — either a single price (the Module 6
   * prompt's minimal example) or an array of `{price, sizePct}`
   * targets (the Risk Engine's actual richer output, see Module 4) —
   * into a flat list of `{price, quantity}` orders.
   * @param {number|Array<{price:number, sizePct:number}>} takeProfit
   * @param {number} totalQuantity
   * @returns {{price:number, quantity:number}[]}
   * @private
   */
  _normalizeTakeProfitTargets(takeProfit, totalQuantity) {
    if (Array.isArray(takeProfit)) {
      return takeProfit.map((t) => ({ price: t.price, quantity: totalQuantity * t.sizePct }));
    }
    if (typeof takeProfit === 'number') {
      return [{ price: takeProfit, quantity: totalQuantity }];
    }
    return [];
  }

  /**
   * @param {import('./types.js').ApprovedExecutionPlan} plan
   * @returns {number}
   * @private
   */
  _estimateEntryPrice(plan) {
    // The plan does not carry a live entry price field directly; the
    // stop-loss distance combined with position size is the only
    // price-anchored information available in the minimal contract,
    // so mid-point-from-stop is used as a conservative reference for
    // quantity/notional/margin calculations. Callers with a live mark
    // price should prefer passing it explicitly — see README.
    return plan.entryPrice ?? plan.stopLoss * (plan.side === 'LONG' ? 1.02 : 0.98);
  }

  /**
   * @param {string} reason
   * @param {number} [startedAt=Date.now()]
   * @returns {import('./types.js').OrderResult}
   * @private
   */
  _noOpResult(reason, startedAt = Date.now()) {
    return {
      success: true,
      orderId: null,
      clientOrderId: null,
      executionPrice: null,
      quantity: null,
      fees: null,
      status: 'NO_OP',
      exchange: this._adapter.exchangeName,
      latency: Date.now() - startedAt,
      timestamp: Date.now(),
      rejectReason: reason,
    };
  }
}

export default ExecutionEngine;
