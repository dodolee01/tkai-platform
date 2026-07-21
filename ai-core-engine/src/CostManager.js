/**
 * @file Tracks estimated AI spend — per user, per provider, and
 * against a configured monthly budget — from the cost figures
 * providers themselves compute per request.
 * @module ai-core-engine/CostManager
 */

export class CostManager {
  /**
   * @param {object} config - `config.cost` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private */ this._totalCostUsd = 0;
    /** @private @type {Map<string, number>} */
    this._byUser = new Map();
    /** @private @type {Map<string, number>} */
    this._byProvider = new Map();
    /** @private @type {Map<string, number>} */
    this._byMonth = new Map();
  }

  /**
   * @param {number} timestamp
   * @returns {string}
   * @private
   */
  _monthKey(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 7);
  }

  /**
   * Record the cost of a completed request.
   * @param {Object} params
   * @param {string} [params.userId]
   * @param {string} params.provider
   * @param {number} params.costUsd
   * @param {number} [params.timestamp=Date.now()]
   * @returns {void}
   */
  recordCost({ userId, provider, costUsd, timestamp = this._clock() }) {
    this._totalCostUsd += costUsd;
    if (userId) this._byUser.set(userId, (this._byUser.get(userId) ?? 0) + costUsd);
    this._byProvider.set(provider, (this._byProvider.get(provider) ?? 0) + costUsd);
    const month = this._monthKey(timestamp);
    this._byMonth.set(month, (this._byMonth.get(month) ?? 0) + costUsd);
  }

  /**
   * @returns {number}
   */
  getTotalCostUsd() {
    return this._totalCostUsd;
  }

  /**
   * @param {string} userId
   * @returns {number}
   */
  getUserCostUsd(userId) {
    return this._byUser.get(userId) ?? 0;
  }

  /**
   * @param {string} provider
   * @returns {number}
   */
  getProviderCostUsd(provider) {
    return this._byProvider.get(provider) ?? 0;
  }

  /**
   * @param {number} [timestamp=Date.now()]
   * @returns {number} Total cost recorded in the calendar month containing `timestamp`.
   */
  getCurrentMonthCostUsd(timestamp = this._clock()) {
    return this._byMonth.get(this._monthKey(timestamp)) ?? 0;
  }

  /**
   * @param {number} [timestamp=Date.now()]
   * @returns {{withinBudget: boolean, spentUsd: number, budgetUsd: number, remainingUsd: number, utilizationPct: number}}
   */
  checkBudget(timestamp = this._clock()) {
    const spentUsd = this.getCurrentMonthCostUsd(timestamp);
    const budgetUsd = this._config.monthlyBudgetUsd;
    return {
      withinBudget: spentUsd < budgetUsd,
      spentUsd,
      budgetUsd,
      remainingUsd: Math.max(0, budgetUsd - spentUsd),
      utilizationPct: budgetUsd === 0 ? 0 : (spentUsd / budgetUsd) * 100,
    };
  }
}

export default CostManager;
