/**
 * @file Continuous equity calculation and time-bucketed equity
 * tracking (current/daily/weekly/monthly/peak/lowest).
 * @module portfolio-engine/EquityCalculator
 */

/**
 * @param {number} timestamp
 * @returns {string}
 * @private
 */
function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * @param {number} timestamp
 * @returns {string}
 * @private
 */
function weekKey(timestamp) {
  const date = new Date(timestamp);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${week}`;
}

/**
 * @param {number} timestamp
 * @returns {string}
 * @private
 */
function monthKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 7);
}

/**
 * Equity = wallet balance + unrealized PnL across all open positions.
 * Computed here as a pure function so callers (PortfolioManager) can
 * recompute it on demand from current balances/positions without any
 * hidden state.
 * @param {number} totalWalletBalance
 * @param {number} totalUnrealizedPnl
 * @returns {number}
 */
export function computeEquity(totalWalletBalance, totalUnrealizedPnl) {
  return totalWalletBalance + totalUnrealizedPnl;
}

/**
 * Tracks an equity curve over time and derives period-start equity
 * (daily/weekly/monthly) plus all-time peak/lowest.
 */
export class EquityCalculator {
  constructor() {
    /** @private @type {{equity:number, timestamp:number}[]} */
    this._history = [];
    /** @private */ this._peak = null;
    /** @private */ this._lowest = null;
  }

  /**
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this._history.push({ equity, timestamp });
    if (this._peak === null || equity > this._peak) this._peak = equity;
    if (this._lowest === null || equity < this._lowest) this._lowest = equity;
  }

  /**
   * @returns {number}
   */
  getCurrentEquity() {
    return this._history.length === 0 ? 0 : this._history[this._history.length - 1].equity;
  }

  /**
   * @param {(timestamp:number) => string} keyFn
   * @returns {number} Equity at the start of the current period (first observation in that period).
   * @private
   */
  _periodStartEquity(keyFn) {
    if (this._history.length === 0) return 0;
    const currentKey = keyFn(this._history[this._history.length - 1].timestamp);
    for (const entry of this._history) {
      if (keyFn(entry.timestamp) === currentKey) return entry.equity;
    }
    return this.getCurrentEquity();
  }

  /**
   * @returns {number} Equity as of the start of the current UTC day.
   */
  getDailyEquity() {
    return this._periodStartEquity(dayKey);
  }

  /**
   * @returns {number} Equity as of the start of the current ISO week.
   */
  getWeeklyEquity() {
    return this._periodStartEquity(weekKey);
  }

  /**
   * @returns {number} Equity as of the start of the current UTC month.
   */
  getMonthlyEquity() {
    return this._periodStartEquity(monthKey);
  }

  /**
   * @returns {number} All-time high equity observed.
   */
  getPeakEquity() {
    return this._peak ?? 0;
  }

  /**
   * @returns {number} All-time low equity observed.
   */
  getLowestEquity() {
    return this._lowest ?? 0;
  }

  /**
   * @returns {import('./types.js').EquityReport}
   */
  getReport() {
    return {
      currentEquity: this.getCurrentEquity(),
      dailyEquity: this.getDailyEquity(),
      weeklyEquity: this.getWeeklyEquity(),
      monthlyEquity: this.getMonthlyEquity(),
      peakEquity: this.getPeakEquity(),
      lowestEquity: this.getLowestEquity(),
    };
  }

  /**
   * @returns {{equity:number, timestamp:number}[]} A snapshot copy of the full recorded history.
   */
  getHistory() {
    return this._history.slice();
  }

  /**
   * Clear all recorded history and peak/lowest tracking.
   * @returns {void}
   */
  reset() {
    this._history = [];
    this._peak = null;
    this._lowest = null;
  }
}

export default { computeEquity, EquityCalculator };
