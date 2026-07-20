/**
 * @file Tracks wallet/available/margin balances per (userId, exchange,
 * asset) tuple, and derives free/used margin and margin ratio.
 * @module portfolio-engine/BalanceManager
 */

/**
 * @param {string} userId
 * @param {string} exchange
 * @param {string} asset
 * @returns {string}
 * @private
 */
function balanceKey(userId, exchange, asset) {
  return `${userId}::${exchange}::${asset}`;
}

/**
 * O(1) per-balance reads/writes over an in-memory map, keyed by
 * (userId, exchange, asset).
 */
export class BalanceManager {
  /**
   * @param {object} config - `config.margin` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private @type {Map<string, import('./types.js').AssetBalance>} */
    this._balances = new Map();
  }

  /**
   * Record/replace a balance snapshot for one (user, exchange, asset).
   * @param {import('./types.js').AssetBalance} balance
   * @returns {void}
   */
  updateBalance(balance) {
    this._balances.set(balanceKey(balance.userId, balance.exchange, balance.asset), { ...balance });
  }

  /**
   * @param {string} userId
   * @param {string} exchange
   * @param {string} asset
   * @returns {import('./types.js').AssetBalance|undefined}
   */
  getBalance(userId, exchange, asset) {
    return this._balances.get(balanceKey(userId, exchange, asset));
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').AssetBalance[]}
   */
  getAllBalances(userId) {
    const all = Array.from(this._balances.values());
    return userId === undefined ? all : all.filter((b) => b.userId === userId);
  }

  /**
   * @param {string} [userId]
   * @returns {number} Sum of wallet balances across every tracked asset (assumes a common quote/valuation currency — see README).
   */
  getTotalWalletBalance(userId) {
    return this.getAllBalances(userId).reduce((a, b) => a + b.walletBalance, 0);
  }

  /**
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalAvailableBalance(userId) {
    return this.getAllBalances(userId).reduce((a, b) => a + b.availableBalance, 0);
  }

  /**
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalMarginBalance(userId) {
    return this.getAllBalances(userId).reduce((a, b) => a + b.marginBalance, 0);
  }

  /**
   * @param {string} [userId]
   * @returns {number}
   */
  getTotalUsedMargin(userId) {
    return this.getAllBalances(userId).reduce((a, b) => a + b.usedMargin, 0);
  }

  /**
   * Free margin = margin balance not currently backing an open position.
   * @param {string} [userId]
   * @returns {number}
   */
  getFreeMargin(userId) {
    return Math.max(0, this.getTotalMarginBalance(userId) - this.getTotalUsedMargin(userId));
  }

  /**
   * @param {string} [userId]
   * @returns {number} usedMargin / marginBalance, or 0 if there is no margin balance.
   */
  getMarginRatio(userId) {
    const marginBalance = this.getTotalMarginBalance(userId);
    if (marginBalance <= 0) return 0;
    return this.getTotalUsedMargin(userId) / marginBalance;
  }

  /**
   * @param {string} [userId]
   * @returns {boolean}
   */
  isMarginCallLevel(userId) {
    return this.getMarginRatio(userId) >= this._config.marginCallRatio;
  }

  /**
   * Remove all tracked balances (e.g. for a full resync).
   * @returns {void}
   */
  reset() {
    this._balances.clear();
  }
}

export default BalanceManager;
