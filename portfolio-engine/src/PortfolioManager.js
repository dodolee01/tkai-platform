/**
 * @file Mid-level manager: owns account/balance state and the
 * currently-known set of open positions (fed in by the caller — this
 * module never fetches positions itself, keeping it decoupled from
 * the Position Engine's source), and computes the aggregate totals
 * (total assets, liabilities, margin figures) the engine needs.
 * @module portfolio-engine/PortfolioManager
 */

import { AccountManager } from './AccountManager.js';
import { BalanceManager } from './BalanceManager.js';
import { computeEquity } from './EquityCalculator.js';

export class PortfolioManager {
  /**
   * @param {object} config - Full portfolio-engine config (uses `margin`).
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @type {AccountManager} */
    this.accountManager = new AccountManager();
    /** @type {BalanceManager} */
    this.balanceManager = new BalanceManager(config.margin);
    /** @private @type {Map<string, import('./types.js').PortfolioPosition>} */
    this._positions = new Map();
  }

  /**
   * Register or update an account (idempotent).
   * @param {string} userId
   * @param {string} exchange
   * @param {'hedge'|'one-way'} [positionMode='one-way']
   * @returns {import('./types.js').Account}
   */
  registerAccount(userId, exchange, positionMode = 'one-way') {
    return this.accountManager.registerAccount(userId, exchange, positionMode);
  }

  /**
   * Feed a balance update (called by the sync layer or directly by
   * an exchange adapter integration).
   * @param {import('./types.js').AssetBalance} balance
   * @returns {void}
   */
  updateBalance(balance) {
    this.balanceManager.updateBalance(balance);
  }

  /**
   * Replace the tracked state for one position. This module holds
   * positions purely as a cache of whatever the Position Engine
   * (Module 7) currently reports — `syncPositions` is the intended
   * bulk-update path; this is available for single-position pushes
   * (e.g. driven by a `positionUpdated` event subscription).
   * @param {import('./types.js').PortfolioPosition} position
   * @returns {void}
   */
  upsertPosition(position) {
    this._positions.set(position.id, { ...position });
  }

  /**
   * @param {string} positionId
   * @returns {boolean}
   */
  removePosition(positionId) {
    return this._positions.delete(positionId);
  }

  /**
   * Bulk-replace the tracked position set (typical of a full sync
   * pull from the Position Engine).
   * @param {import('./types.js').PortfolioPosition[]} positions
   * @returns {void}
   */
  syncPositions(positions) {
    this._positions = new Map(positions.map((p) => [p.id, { ...p }]));
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').PortfolioPosition[]}
   */
  getPositions(userId) {
    const all = Array.from(this._positions.values());
    return userId === undefined ? all : all.filter((p) => p.userId === userId);
  }

  /**
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalUnrealizedPnl(userId) {
    return this.getPositions(userId).reduce((a, p) => a + p.unrealizedPnl, 0);
  }

  /**
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalRealizedPnl(userId) {
    return this.getPositions(userId).reduce((a, p) => a + p.realizedPnl, 0);
  }

  /**
   * @param {string} [userId]
   * @returns {number} Current equity: total wallet balance + total unrealized PnL.
   */
  getCurrentEquity(userId) {
    return computeEquity(this.balanceManager.getTotalWalletBalance(userId), this.getTotalUnrealizedPnl(userId));
  }

  /**
   * "Total assets" = wallet balance + unrealized PnL (mirrors equity;
   * exposed separately per the module's tracked-fields requirement,
   * since a caller may want to reason about assets independent of
   * calling it "equity").
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalAssets(userId) {
    return this.getCurrentEquity(userId);
  }

  /**
   * "Total liabilities" = used margin currently owed against open
   * positions (the portion of wallet balance not freely withdrawable).
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalLiabilities(userId) {
    return this.balanceManager.getTotalUsedMargin(userId);
  }
}

export default PortfolioManager;
