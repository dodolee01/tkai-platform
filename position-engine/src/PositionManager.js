/**
 * @file Owns the live in-memory set of positions: creation, field
 * updates, and state transitions, with every derived field
 * (PnL/ROI/margin/liquidation) recomputed on every mark-price or
 * quantity change. Delegates persistence to an injected
 * {@link PositionRepository} and publishes lifecycle events via an
 * injected {@link EventPublisher}.
 * @module position-engine/PositionManager
 */

import { randomUUID } from 'node:crypto';
import { PositionState, assertValidTransition } from './PositionStateMachine.js';
import { PositionEvents } from './EventPublisher.js';
import { computeUnrealizedPnl } from './PnLCalculator.js';
import { computeRoi } from './ROIEngine.js';
import { computeInitialMargin, computeMaintenanceMargin, computeMarginRatio } from './MarginCalculator.js';
import { estimateLiquidationPrice } from './LiquidationCalculator.js';

/**
 * O(1)-per-position CRUD and derived-field maintenance over an
 * in-memory `Map`. Designed to comfortably support 300+ simultaneous
 * positions: every public method here operates on a single position
 * by id, never scans the full set (multi-position aggregation lives
 * in {@link ExposureManager} / {@link PositionStatistics}, which take
 * an explicit list from the caller).
 */
export class PositionManager {
  /**
   * @param {Object} deps
   * @param {import('./PositionRepository.js').PositionRepository} deps.repository
   * @param {import('./EventPublisher.js').EventPublisher} deps.eventPublisher
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - Full position-engine config (uses `margin`).
   */
  constructor({ repository, eventPublisher, logger = null }, config) {
    /** @private */ this._repository = repository;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
    /** @private @type {Map<string, import('./types.js').Position>} */
    this._positions = new Map();
  }

  /**
   * Load every position from the repository into the in-memory cache.
   * Call once at startup.
   * @returns {Promise<void>}
   */
  async hydrate() {
    const all = await this._repository.getAll();
    this._positions = new Map(all.map((p) => [p.id, p]));
  }

  /**
   * Create a new position record in the NEW state and immediately
   * transition it through OPENING to OPEN (matching a synchronous
   * "already filled" entry, as delivered by the Execution Engine).
   * @param {Object} input
   * @param {string} input.symbol
   * @param {string} input.userId
   * @param {string} input.exchange
   * @param {'LONG'|'SHORT'} input.side
   * @param {'hedge'|'one-way'} [input.positionMode='one-way']
   * @param {number} input.entryPrice
   * @param {number} input.quantity
   * @param {number} input.leverage
   * @param {number|null} [input.stopLoss=null]
   * @param {number|null} [input.takeProfit=null]
   * @param {number} [input.tradingFees=0]
   * @returns {Promise<import('./types.js').Position>}
   */
  async openPosition(input) {
    const now = Date.now();
    const notional = input.entryPrice * input.quantity;
    const maintenanceMarginRate = this._config.margin.defaultMaintenanceMarginRate;

    /** @type {import('./types.js').Position} */
    let position = {
      id: randomUUID(),
      symbol: input.symbol,
      userId: input.userId,
      exchange: input.exchange,
      side: input.side,
      positionMode: input.positionMode ?? 'one-way',
      state: PositionState.NEW,
      entryPrice: input.entryPrice,
      averageEntryPrice: input.entryPrice,
      markPrice: input.entryPrice,
      quantity: input.quantity,
      remainingQuantity: input.quantity,
      leverage: input.leverage,
      initialMargin: computeInitialMargin(notional, input.leverage),
      maintenanceMargin: computeMaintenanceMargin(notional, maintenanceMarginRate),
      liquidationPrice: estimateLiquidationPrice(input.side, input.entryPrice, input.leverage, maintenanceMarginRate),
      marginRatio: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      fundingFees: 0,
      tradingFees: input.tradingFees ?? 0,
      roi: 0,
      stopLoss: input.stopLoss ?? null,
      initialStopLoss: input.stopLoss ?? null,
      takeProfit: input.takeProfit ?? null,
      breakEvenActivated: false,
      trailingActive: false,
      openedAt: now,
      updatedAt: now,
      closedAt: null,
      closeHistory: [],
    };
    position.marginRatio = computeMarginRatio(position.maintenanceMargin, position.initialMargin);

    position = this._transition(position, PositionState.OPENING);
    position = this._transition(position, PositionState.OPEN);

    this._positions.set(position.id, position);
    await this._repository.save(position);

    this._eventPublisher?.safeEmit(PositionEvents.POSITION_OPENED, position);
    return position;
  }

  /**
   * Apply a new mark price: recompute unrealized PnL, ROI, margin
   * ratio, and liquidation distance. Emits `positionUpdated`, and
   * `positionLiquidated` if the new mark price breaches the
   * liquidation price.
   * @param {string} positionId
   * @param {number} markPrice
   * @returns {Promise<import('./types.js').Position>}
   */
  async updateMarkPrice(positionId, markPrice) {
    const position = this._require(positionId);
    position.markPrice = markPrice;
    position.unrealizedPnl = computeUnrealizedPnl(position.side, position.averageEntryPrice, markPrice, position.remainingQuantity);
    position.roi = computeRoi(position.unrealizedPnl, position.initialMargin);
    position.marginRatio = computeMarginRatio(position.maintenanceMargin, position.initialMargin + position.unrealizedPnl);
    position.updatedAt = Date.now();

    await this._persist(position);
    this._eventPublisher?.safeEmit(PositionEvents.POSITION_UPDATED, position);

    const breached =
      position.side === 'LONG' ? markPrice <= position.liquidationPrice : markPrice >= position.liquidationPrice;
    if (breached) {
      this._eventPublisher?.safeEmit(PositionEvents.POSITION_LIQUIDATED, position);
    }

    return position;
  }

  /**
   * Apply arbitrary field updates (used by the calculator/engine
   * modules after they compute a new stop-loss, break-even flag,
   * trailing state, etc.), then persist and emit `positionUpdated`.
   * @param {string} positionId
   * @param {Partial<import('./types.js').Position>} patch
   * @returns {Promise<import('./types.js').Position>}
   */
  async applyPatch(positionId, patch) {
    const position = this._require(positionId);
    Object.assign(position, patch, { updatedAt: Date.now() });
    await this._persist(position);
    this._eventPublisher?.safeEmit(PositionEvents.POSITION_UPDATED, position);
    return position;
  }

  /**
   * Reduce a position (partial close) by a specific quantity,
   * recomputing remaining quantity, realized PnL, and — if the
   * position is now fully flat — transitioning it to CLOSING then CLOSED.
   * @param {string} positionId
   * @param {number} closedQuantity
   * @param {number} realizedPnl
   * @param {number} closePrice
   * @returns {Promise<import('./types.js').Position>}
   */
  async reducePosition(positionId, closedQuantity, realizedPnl, closePrice) {
    const position = this._require(positionId);
    const now = Date.now();

    position.remainingQuantity = Math.max(0, position.remainingQuantity - closedQuantity);
    position.realizedPnl += realizedPnl;
    position.closeHistory.push({ price: closePrice, quantity: closedQuantity, closedAt: now, realizedPnl });
    position.updatedAt = now;

    const isFullyClosed = position.remainingQuantity <= 0;

    if (isFullyClosed) {
      if (position.state !== PositionState.CLOSING) {
        const fromForClosing = position.state;
        assertValidTransition(fromForClosing, PositionState.CLOSING);
        position.state = PositionState.CLOSING;
      }
      position.state = this._transition(position, PositionState.CLOSED).state;
      position.closedAt = now;
      await this._persist(position);
      this._eventPublisher?.safeEmit(PositionEvents.POSITION_CLOSED, position);
    } else {
      if (position.state === PositionState.OPEN || position.state === PositionState.TRAILING) {
        position.state = PositionState.PARTIALLY_CLOSED;
      }
      await this._persist(position);
      this._eventPublisher?.safeEmit(PositionEvents.POSITION_REDUCED, position);
    }

    return position;
  }

  /**
   * Move a position to the ARCHIVED terminal state (e.g. after its
   * closed-trade statistics have been consumed by the Learning Engine).
   * @param {string} positionId
   * @returns {Promise<import('./types.js').Position>}
   */
  async archivePosition(positionId) {
    const position = this._require(positionId);
    this._transition(position, PositionState.ARCHIVED);
    await this._persist(position);
    return position;
  }

  /**
   * @param {import('./types.js').Position} position
   * @param {string} toState
   * @returns {import('./types.js').Position}
   * @private
   */
  _transition(position, toState) {
    assertValidTransition(position.state, toState);
    position.state = toState;
    position.updatedAt = Date.now();
    return position;
  }

  /**
   * @param {import('./types.js').Position} position
   * @returns {Promise<void>}
   * @private
   */
  async _persist(position) {
    this._positions.set(position.id, position);
    await this._repository.save(position);
  }

  /**
   * @param {string} positionId
   * @returns {import('./types.js').Position}
   * @private
   */
  _require(positionId) {
    const position = this._positions.get(positionId);
    if (!position) throw new Error(`PositionManager: no position with id "${positionId}"`);
    return position;
  }

  /**
   * @param {string} positionId
   * @returns {import('./types.js').Position|undefined}
   */
  get(positionId) {
    return this._positions.get(positionId);
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').Position[]}
   */
  getOpenPositions(userId) {
    const liveStates = new Set([
      PositionState.NEW, PositionState.OPENING, PositionState.OPEN,
      PositionState.PARTIALLY_CLOSED, PositionState.TRAILING, PositionState.CLOSING,
    ]);
    return Array.from(this._positions.values()).filter(
      (p) => liveStates.has(p.state) && (userId === undefined || p.userId === userId)
    );
  }

  /**
   * @returns {import('./types.js').Position[]}
   */
  getAll() {
    return Array.from(this._positions.values());
  }
}

export default PositionManager;
