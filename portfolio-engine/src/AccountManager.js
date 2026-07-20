/**
 * @file Registry of tracked accounts: (userId, exchange) pairs, each
 * with a position mode (hedge/one-way). This is the multi-user,
 * multi-exchange support surface — every other module in this engine
 * takes an optional `userId`/`exchange` filter rather than assuming
 * a single account.
 * @module portfolio-engine/AccountManager
 */

/**
 * @param {string} userId
 * @param {string} exchange
 * @returns {string}
 * @private
 */
function accountKey(userId, exchange) {
  return `${userId}::${exchange}`;
}

export class AccountManager {
  constructor() {
    /** @private @type {Map<string, import('./types.js').Account>} */
    this._accounts = new Map();
  }

  /**
   * Register a new account, or update the position mode of an
   * existing one (idempotent — safe to call on every login/sync).
   * @param {string} userId
   * @param {string} exchange
   * @param {'hedge'|'one-way'} [positionMode='one-way']
   * @returns {import('./types.js').Account}
   */
  registerAccount(userId, exchange, positionMode = 'one-way') {
    const key = accountKey(userId, exchange);
    const existing = this._accounts.get(key);
    if (existing) {
      existing.positionMode = positionMode;
      return existing;
    }
    const account = { userId, exchange, positionMode, createdAt: Date.now() };
    this._accounts.set(key, account);
    return account;
  }

  /**
   * @param {string} userId
   * @param {string} exchange
   * @returns {import('./types.js').Account|undefined}
   */
  getAccount(userId, exchange) {
    return this._accounts.get(accountKey(userId, exchange));
  }

  /**
   * @param {string} [userId]
   * @returns {import('./types.js').Account[]}
   */
  getAccounts(userId) {
    const all = Array.from(this._accounts.values());
    return userId === undefined ? all : all.filter((a) => a.userId === userId);
  }

  /**
   * @returns {string[]} Every distinct userId with at least one registered account.
   */
  getUserIds() {
    return Array.from(new Set(Array.from(this._accounts.values()).map((a) => a.userId)));
  }

  /**
   * @returns {string[]} Every distinct exchange with at least one registered account.
   */
  getExchanges() {
    return Array.from(new Set(Array.from(this._accounts.values()).map((a) => a.exchange)));
  }

  /**
   * @param {string} userId
   * @param {string} exchange
   * @returns {boolean}
   */
  hasAccount(userId, exchange) {
    return this._accounts.has(accountKey(userId, exchange));
  }

  /**
   * @param {string} userId
   * @param {string} exchange
   * @returns {boolean}
   */
  removeAccount(userId, exchange) {
    return this._accounts.delete(accountKey(userId, exchange));
  }
}

export default AccountManager;
