/**
 * @file The position engine orchestrator — wires PositionManager,
 * the calculator modules, break-even/trailing engines, statistics,
 * drawdown, exposure, and synchronization into a single public API.
 * This is the module's sole integration point for the Execution
 * Engine (Module 6), Risk Engine (Module 4), and Learning Engine
 * (Module 5).
 * @module position-engine/PositionEngine
 */

import { createConfig } from './Config.js';
import { PositionManager } from './PositionManager.js';
import { InMemoryPositionRepository } from './PositionRepository.js';
import { EventPublisher, PositionEvents } from './EventPublisher.js';
import { PositionSynchronizer } from './PositionSynchronizer.js';
import { DrawdownTracker } from './DrawdownTracker.js';
import { ExposureManager } from './ExposureManager.js';
import { executePartialClose, executePresetPartialClose } from './PartialCloseEngine.js';
import { evaluateBreakEven } from './BreakEvenEngine.js';
import { evaluateTrailingStop } from './TrailingStopEngine.js';
import { computeStatistics } from './PositionStatistics.js';
import { PositionState } from './PositionStateMachine.js';

/**
 * The institutional position engine.
 */
export class PositionEngine {
  /**
   * @param {Object} [deps]
   * @param {import('./PositionRepository.js').PositionRepository} [deps.repository] - Defaults to an in-memory repository.
   * @param {(symbol: string) => Promise<import('./types.js').ExchangePositionSnapshot|null>} [deps.fetchExchangePosition] - Required only if {@link PositionEngine#syncAll} is used.
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ repository = new InMemoryPositionRepository(), fetchExchangePosition, logger = null } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._logger = logger;

    /** @type {EventPublisher} */
    this.eventPublisher = new EventPublisher();
    /** @type {PositionManager} */
    this.positionManager = new PositionManager({ repository, eventPublisher: this.eventPublisher, logger }, this.config);
    /** @type {DrawdownTracker} */
    this.drawdownTracker = new DrawdownTracker(this.config.drawdown);
    /** @type {ExposureManager} */
    this.exposureManager = new ExposureManager(this.config.exposure);

    if (fetchExchangePosition) {
      /** @type {PositionSynchronizer|null} */
      this.synchronizer = new PositionSynchronizer({ fetchExchangePosition, logger }, this.config.synchronizer);
    } else {
      this.synchronizer = null;
    }
  }

  /**
   * Load prior position history from the repository. Call once at startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.positionManager.hydrate();
  }

  /**
   * Open a new position (called by the Execution Engine immediately
   * after a fill).
   * @param {Object} input - See {@link PositionManager#openPosition}.
   * @returns {Promise<import('./types.js').Position>}
   */
  async openPosition(input) {
    return this.positionManager.openPosition(input);
  }

  /**
   * Feed a new mark price for a position, recomputing every derived
   * field and evaluating break-even/trailing-stop conditions if
   * enabled for that position.
   * @param {string} positionId
   * @param {number} markPrice
   * @param {Object} [context]
   * @param {number} [context.currentAtr]
   * @param {number} [context.volatility]
   * @returns {Promise<import('./types.js').Position>}
   */
  async updateMarkPrice(positionId, markPrice, context = {}) {
    let position = await this.positionManager.updateMarkPrice(positionId, markPrice);

    if (position.stopLoss !== null && this.config.breakEven && !position.breakEvenActivated) {
      const beResult = evaluateBreakEven(
        {
          side: position.side,
          entryPrice: position.averageEntryPrice,
          markPrice,
          initialStopLoss: position.initialStopLoss,
          currentStopLoss: position.stopLoss,
          currentAtr: context.currentAtr,
          alreadyActivated: position.breakEvenActivated,
        },
        this.config.breakEven
      );
      if (beResult.shouldActivate) {
        position = await this.positionManager.applyPatch(positionId, { stopLoss: beResult.newStopLoss, breakEvenActivated: true });
        this.eventPublisher.safeEmit(PositionEvents.BREAK_EVEN_ACTIVATED, position);
      }
    }

    if (position.stopLoss !== null) {
      const trailResult = evaluateTrailingStop(
        {
          side: position.side,
          entryPrice: position.averageEntryPrice,
          markPrice,
          initialStopLoss: position.initialStopLoss,
          currentStopLoss: position.stopLoss,
          currentAtr: context.currentAtr,
          volatility: context.volatility,
          lastStepPrice: position.lastStepPrice,
        },
        this.config.trailing
      );
      if (trailResult.isTrailing && trailResult.stopLoss !== position.stopLoss) {
        const patch = { stopLoss: trailResult.stopLoss, trailingActive: true };
        if (trailResult.lastStepPrice !== undefined) patch.lastStepPrice = trailResult.lastStepPrice;
        if (position.state === PositionState.OPEN || position.state === PositionState.PARTIALLY_CLOSED) {
          patch.state = PositionState.TRAILING;
        }
        position = await this.positionManager.applyPatch(positionId, patch);
        this.eventPublisher.safeEmit(PositionEvents.TRAILING_UPDATED, position);
      }
    }

    if (position.takeProfit !== null) {
      const tpHit = position.side === 'LONG' ? markPrice >= position.takeProfit : markPrice <= position.takeProfit;
      if (tpHit) this.eventPublisher.safeEmit(PositionEvents.TAKE_PROFIT_HIT, position);
    }
    if (position.stopLoss !== null) {
      const slHit = position.side === 'LONG' ? markPrice <= position.stopLoss : markPrice >= position.stopLoss;
      if (slHit) this.eventPublisher.safeEmit(PositionEvents.STOP_LOSS_HIT, position);
    }

    return position;
  }

  /**
   * Partially close a position by a fraction (or a standard preset
   * percentage via `presetPercent`), fully recalculating remaining
   * quantity, realized PnL, and position state.
   * @param {string} positionId
   * @param {Object} options
   * @param {number} [options.fraction] - 0 < fraction <= 1.
   * @param {10|25|50|75} [options.presetPercent]
   * @param {number} options.closePrice
   * @returns {Promise<import('./types.js').Position>}
   */
  async partialClose(positionId, { fraction, presetPercent, closePrice }) {
    const position = this.positionManager.get(positionId);
    if (!position) throw new Error(`PositionEngine.partialClose: no position with id "${positionId}"`);

    const closeInput = {
      side: position.side,
      averageEntryPrice: position.averageEntryPrice,
      remainingQuantity: position.remainingQuantity,
      closePrice,
      leverage: position.leverage,
    };
    const result = presetPercent !== undefined
      ? executePresetPartialClose(closeInput, presetPercent)
      : executePartialClose(closeInput, fraction);

    return this.positionManager.reducePosition(positionId, result.closedQuantity, result.realizedPnl, closePrice);
  }

  /**
   * Synchronize every currently-open position against the exchange
   * (requires `fetchExchangePosition` to have been supplied at construction).
   * @returns {Promise<import('./types.js').SyncDifference[]>}
   */
  async syncAll() {
    if (!this.synchronizer) {
      throw new Error('PositionEngine.syncAll: no fetchExchangePosition dependency was supplied at construction');
    }
    return this.synchronizer.syncAll(this.positionManager.getOpenPositions());
  }

  /**
   * Record a new equity observation for drawdown tracking (call
   * whenever account equity changes — typically after every fill/close).
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this.drawdownTracker.recordEquity(equity, timestamp);
  }

  /**
   * @returns {import('./types.js').DrawdownReport}
   */
  getDrawdownReport() {
    return this.drawdownTracker.getReport();
  }

  /**
   * @param {number} equity
   * @returns {import('./types.js').ExposureReport}
   */
  getExposureReport(equity) {
    return this.exposureManager.computeExposure(this.positionManager.getOpenPositions(), equity);
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').PositionStatisticsReport}
   */
  getStatistics(userId) {
    const closed = this.positionManager
      .getAll()
      .filter((p) => (p.state === PositionState.CLOSED || p.state === PositionState.ARCHIVED) && (userId === undefined || p.userId === userId))
      .map((p) => ({ realizedPnl: p.realizedPnl, openedAt: p.openedAt, closedAt: p.closedAt ?? p.updatedAt }));
    return computeStatistics(closed, this.config.statistics);
  }
}

export default PositionEngine;
