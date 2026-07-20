/**
 * @file The portfolio engine orchestrator — wires PortfolioManager,
 * the calculator modules (equity/exposure/allocation/capital/
 * performance), snapshots, and event publishing into a single public
 * API. This is the module's sole integration point for the Position
 * Engine (Module 7), Risk Engine (Module 4), and Learning Engine
 * (Module 5).
 * @module portfolio-engine/PortfolioEngine
 */

import { createConfig } from './Config.js';
import { PortfolioManager } from './PortfolioManager.js';
import { InMemoryPortfolioRepository } from './PortfolioRepository.js';
import { PortfolioEventPublisher, PortfolioEventNames } from './PortfolioEvents.js';
import { EquityCalculator } from './EquityCalculator.js';
import { ExposureCalculator } from './ExposureCalculator.js';
import { AssetAllocation } from './AssetAllocation.js';
import { CapitalManager } from './CapitalManager.js';
import { computePerformanceReport } from './PerformanceTracker.js';
import { createSnapshot, SnapshotScheduler } from './PortfolioSnapshot.js';

/**
 * The institutional portfolio engine.
 */
export class PortfolioEngine {
  /**
   * @param {Object} [deps]
   * @param {import('./PortfolioRepository.js').PortfolioRepository} [deps.repository] - Defaults to an in-memory repository.
   * @param {(userId?: string) => Promise<import('./types.js').PortfolioPosition[]>} [deps.fetchPositions] - Injected Position Engine sync source; required for {@link PortfolioEngine#syncPositions}.
   * @param {(userId: string, exchange: string) => Promise<import('./types.js').AssetBalance[]>} [deps.fetchExchangeBalances] - Injected exchange-adapter sync source; required for {@link PortfolioEngine#syncBalances}.
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ repository = new InMemoryPortfolioRepository(), fetchPositions, fetchExchangeBalances, logger = null } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._repository = repository;
    /** @private */ this._fetchPositions = fetchPositions ?? null;
    /** @private */ this._fetchExchangeBalances = fetchExchangeBalances ?? null;
    /** @private */ this._logger = logger;

    /** @type {PortfolioEventPublisher} */
    this.eventPublisher = new PortfolioEventPublisher();
    /** @type {PortfolioManager} */
    this.portfolioManager = new PortfolioManager(this.config);
    /** @private @type {Map<string, EquityCalculator>} */
    this._equityCalculators = new Map();
    /** @type {ExposureCalculator} */
    this.exposureCalculator = new ExposureCalculator(this.config.exposure);
    /** @type {AssetAllocation} */
    this.assetAllocation = new AssetAllocation(this.config.exposure);
    /** @type {CapitalManager} */
    this.capitalManager = new CapitalManager(this.config.capital);
    /** @type {SnapshotScheduler} */
    this.snapshotScheduler = new SnapshotScheduler(this.config.snapshot);

    /** @private @type {import('./types.js').ClosedTrade[]} */
    this._closedTrades = [];
    /** @private */ this._startEquity = null;
    /** @private */ this._startedAt = Date.now();
  }

  /**
   * @param {string} [userId]
   * @returns {EquityCalculator} The per-user equity calculator, created lazily. A dedicated
   *   key represents the "all users" aggregate view (userId === undefined).
   * @private
   */
  _getEquityCalculator(userId) {
    const key = userId ?? '__all__';
    let calculator = this._equityCalculators.get(key);
    if (!calculator) {
      calculator = new EquityCalculator();
      this._equityCalculators.set(key, calculator);
    }
    return calculator;
  }

  /**
   * Load prior balances/snapshots from the repository. Call once at startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    const balances = await this._repository.getBalances();
    for (const balance of balances) this.portfolioManager.updateBalance(balance);
  }

  /**
   * Register an account (called once per user/exchange the platform trades on).
   * @param {string} userId
   * @param {string} exchange
   * @param {'hedge'|'one-way'} [positionMode='one-way']
   * @returns {import('./types.js').Account}
   */
  registerAccount(userId, exchange, positionMode = 'one-way') {
    return this.portfolioManager.registerAccount(userId, exchange, positionMode);
  }

  /**
   * Feed a balance update, persist it, and emit `balanceChanged`.
   * @param {import('./types.js').AssetBalance} balance
   * @returns {Promise<void>}
   */
  async updateBalance(balance) {
    this.portfolioManager.updateBalance(balance);
    await this._repository.saveBalance(balance);
    this.eventPublisher.safeEmit(PortfolioEventNames.BALANCE_CHANGED, balance);
    await this._recomputeAndPublish(balance.userId);
  }

  /**
   * Pull the latest balances for one account from the injected
   * exchange-adapter fetch function (duck-typed against Module 6's
   * `getBalance()` shape) and apply them.
   * @param {string} userId
   * @param {string} exchange
   * @returns {Promise<import('./types.js').AssetBalance[]>}
   */
  async syncBalances(userId, exchange) {
    if (!this._fetchExchangeBalances) {
      throw new Error('PortfolioEngine.syncBalances: no fetchExchangeBalances dependency was supplied at construction');
    }
    const balances = await this._fetchExchangeBalances(userId, exchange);
    for (const balance of balances) {
      await this.updateBalance({ ...balance, userId, exchange });
    }
    return balances;
  }

  /**
   * Pull the current open-position set from the injected Position
   * Engine fetch function (duck-typed against Module 7's
   * `getOpenPositions()` shape) and reconcile it against local state.
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').PortfolioPosition[]>}
   */
  async syncPositions(userId) {
    if (!this._fetchPositions) {
      throw new Error('PortfolioEngine.syncPositions: no fetchPositions dependency was supplied at construction');
    }
    const positions = await this._fetchPositions(userId);
    this.portfolioManager.syncPositions(positions);
    await this._recomputeAndPublish(userId);
    return positions;
  }

  /**
   * Record a completed trade (called on the Position Engine's
   * `positionClosed` event, or directly by an integration layer) for
   * performance tracking.
   * @param {import('./types.js').ClosedTrade} trade
   * @returns {Promise<void>}
   */
  async recordClosedTrade(trade) {
    this._closedTrades.push(trade);
    await this._recomputeAndPublish(trade.userId);
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').EquityReport}
   */
  getEquityReport(userId) {
    return this._getEquityCalculator(userId).getReport();
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').ExposureReport}
   */
  getExposureReport(userId) {
    const equity = this.portfolioManager.getCurrentEquity(userId);
    return this.exposureCalculator.computeExposure(this.portfolioManager.getPositions(userId), equity);
  }

  /**
   * @param {string} [userId]
   * @param {Object.<string, string>} [strategyBySymbol]
   * @returns {import('./types.js').AllocationReport}
   */
  getAllocationReport(userId, strategyBySymbol) {
    const equity = this.portfolioManager.getCurrentEquity(userId);
    return this.assetAllocation.computeAllocation(this.portfolioManager.getPositions(userId), equity, strategyBySymbol);
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').CapitalReport}
   */
  getCapitalReport(userId) {
    const equity = this.portfolioManager.getCurrentEquity(userId);
    const usedMargin = this.portfolioManager.getTotalLiabilities(userId);
    return this.capitalManager.computeCapitalReport(equity, usedMargin);
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').PerformanceReport}
   */
  getPerformanceReport(userId) {
    const trades = userId === undefined ? this._closedTrades : this._closedTrades.filter((t) => t.userId === userId);
    const currentEquity = this.portfolioManager.getCurrentEquity(userId);
    return computePerformanceReport(
      trades,
      {
        startEquity: this._startEquity ?? currentEquity,
        currentEquity,
        peakEquity: this._getEquityCalculator(userId).getPeakEquity(),
        lowestEquity: this._getEquityCalculator(userId).getLowestEquity(),
        elapsedMs: Date.now() - this._startedAt,
      },
      this.config.performance
    );
  }

  /**
   * Recompute equity, publish standard events, and create a snapshot
   * for every due granularity (including realtime, always).
   * @param {string} [userId]
   * @returns {Promise<void>}
   * @private
   */
  async _recomputeAndPublish(userId) {
    const equity = this.portfolioManager.getCurrentEquity(userId);
    if (this._startEquity === null) this._startEquity = equity;
    this._getEquityCalculator(userId).recordEquity(equity);

    this.eventPublisher.safeEmit(PortfolioEventNames.EQUITY_CHANGED, this._getEquityCalculator(userId).getReport());

    const exposure = this.getExposureReport(userId);
    this.eventPublisher.safeEmit(PortfolioEventNames.EXPOSURE_CHANGED, exposure);

    const allocation = this.getAllocationReport(userId);
    this.eventPublisher.safeEmit(PortfolioEventNames.ALLOCATION_CHANGED, allocation);

    const performance = this.getPerformanceReport(userId);
    this.eventPublisher.safeEmit(PortfolioEventNames.PERFORMANCE_UPDATED, performance);

    this.eventPublisher.safeEmit(PortfolioEventNames.PORTFOLIO_UPDATED, {
      userId, equity: this._getEquityCalculator(userId).getReport(), exposure, allocation, performance,
    });

    await this.takeSnapshot('realtime', userId);
    for (const granularity of this.snapshotScheduler.getDueGranularities()) {
      await this.takeSnapshot(granularity, userId);
      this.snapshotScheduler.markTaken(granularity);
    }
  }

  /**
   * Take an immutable snapshot of the current full portfolio state,
   * persist it, and emit `snapshotCreated`.
   * @param {'realtime'|'daily'|'weekly'|'monthly'} granularity
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').PortfolioSnapshotRecord>}
   */
  async takeSnapshot(granularity, userId) {
    const snapshot = createSnapshot(
      granularity,
      this._getEquityCalculator(userId).getReport(),
      this.getExposureReport(userId),
      this.getAllocationReport(userId),
      this.getCapitalReport(userId),
      this.getPerformanceReport(userId)
    );
    await this._repository.saveSnapshot(snapshot);
    this.eventPublisher.safeEmit(PortfolioEventNames.SNAPSHOT_CREATED, snapshot);
    return snapshot;
  }
}

export default PortfolioEngine;
