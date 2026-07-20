/**
 * @file Time-bucketed drawdown tracking: daily, weekly, monthly,
 * max, current, and recovery percentage — computed from a running
 * equity curve fed via {@link DrawdownTracker#recordEquity}.
 * @module position-engine/DrawdownTracker
 */

/**
 * @param {number} timestamp
 * @returns {string} UTC calendar-day key.
 * @private
 */
function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * @param {number} timestamp
 * @returns {string} ISO week key (year-week number).
 * @private
 */
function weekKey(timestamp) {
  const date = new Date(timestamp);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${week}`;
}

/**
 * @param {number} timestamp
 * @returns {string} UTC calendar-month key.
 * @private
 */
function monthKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 7);
}

/**
 * Tracks an equity curve and derives drawdown at multiple time
 * granularities. Each period's drawdown is measured against that
 * period's own starting equity (peak reset at period boundaries for
 * daily/weekly/monthly); `maxDrawdownPct`/`currentDrawdownPct` are
 * measured against the all-time running peak.
 */
export class DrawdownTracker {
  /**
   * @param {object} config - `config.drawdown` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private @type {{equity:number, timestamp:number}[]} */
    this._history = [];
    /** @private */ this._allTimePeak = null;
  }

  /**
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this._history.push({ equity, timestamp });
    if (this._allTimePeak === null || equity > this._allTimePeak) this._allTimePeak = equity;
  }

  /**
   * @param {(timestamp:number) => string} keyFn
   * @returns {number} Drawdown fraction within the most recent period (peak-to-current, reset each period).
   * @private
   */
  _periodDrawdown(keyFn) {
    if (this._history.length === 0) return 0;
    const currentKey = keyFn(this._history[this._history.length - 1].timestamp);
    const periodEntries = [];
    for (let i = this._history.length - 1; i >= 0; i--) {
      if (keyFn(this._history[i].timestamp) !== currentKey) break;
      periodEntries.unshift(this._history[i]);
    }
    let peak = -Infinity;
    let maxDd = 0;
    for (const entry of periodEntries) {
      if (entry.equity > peak) peak = entry.equity;
      if (peak > 0) {
        const dd = (peak - entry.equity) / peak;
        if (dd > maxDd) maxDd = dd;
      }
    }
    return maxDd;
  }

  /**
   * @returns {number}
   */
  getDailyDrawdownPct() {
    return this._periodDrawdown(dayKey) * 100;
  }

  /**
   * @returns {number}
   */
  getWeeklyDrawdownPct() {
    return this._periodDrawdown(weekKey) * 100;
  }

  /**
   * @returns {number}
   */
  getMonthlyDrawdownPct() {
    return this._periodDrawdown(monthKey) * 100;
  }

  /**
   * @returns {number} Max drawdown across the entire recorded history.
   */
  getMaxDrawdownPct() {
    if (this._history.length === 0) return 0;
    let peak = -Infinity;
    let maxDd = 0;
    for (const entry of this._history) {
      if (entry.equity > peak) peak = entry.equity;
      if (peak > 0) {
        const dd = (peak - entry.equity) / peak;
        if (dd > maxDd) maxDd = dd;
      }
    }
    return maxDd * 100;
  }

  /**
   * @returns {number} Current drawdown from the all-time peak.
   */
  getCurrentDrawdownPct() {
    if (this._history.length === 0 || this._allTimePeak === null || this._allTimePeak <= 0) return 0;
    const current = this._history[this._history.length - 1].equity;
    return Math.max(0, (this._allTimePeak - current) / this._allTimePeak) * 100;
  }

  /**
   * @returns {number} Percentage recovered from the trough back toward the all-time peak (100 = fully recovered).
   */
  getRecoveryPct() {
    if (this._history.length === 0 || this._allTimePeak === null || this._allTimePeak <= 0) return 100;
    let trough = this._allTimePeak;
    for (const entry of this._history) {
      if (entry.equity < trough) trough = entry.equity;
    }
    const current = this._history[this._history.length - 1].equity;
    if (this._allTimePeak === trough) return 100;
    return Math.min(100, Math.max(0, ((current - trough) / (this._allTimePeak - trough)) * 100));
  }

  /**
   * @returns {boolean}
   */
  isMaxDrawdownExceeded() {
    return this.getCurrentDrawdownPct() / 100 >= this._config.maxDrawdownPct;
  }

  /**
   * @returns {import('./types.js').DrawdownReport}
   */
  getReport() {
    return {
      dailyDrawdownPct: this.getDailyDrawdownPct(),
      weeklyDrawdownPct: this.getWeeklyDrawdownPct(),
      monthlyDrawdownPct: this.getMonthlyDrawdownPct(),
      maxDrawdownPct: this.getMaxDrawdownPct(),
      currentDrawdownPct: this.getCurrentDrawdownPct(),
      recoveryPct: this.getRecoveryPct(),
    };
  }
}

export default DrawdownTracker;
