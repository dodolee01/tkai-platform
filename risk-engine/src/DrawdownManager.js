/**
 * @file Tracks the account equity curve and computes drawdown /
 * equity-protection state. Fed externally (by the Execution or
 * Learning Engine) via {@link DrawdownManager#recordEquity}.
 * @module risk-engine/DrawdownManager
 */

/**
 * Owns a rolling equity curve and derives current drawdown and
 * equity-protection ("kill switch") status from it.
 */
export class DrawdownManager {
  /**
   * @param {object} config - `config.drawdown` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private */ this._peakEquity = null;
    /** @private */ this._currentEquity = null;
    /** @private @type {{equity:number, timestamp:number}[]} */
    this._history = [];
  }

  /**
   * Record a new equity observation, updating the running peak.
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this._currentEquity = equity;
    if (this._peakEquity === null || equity > this._peakEquity) {
      this._peakEquity = equity;
    }
    this._history.push({ equity, timestamp });
    if (this._history.length > 10000) this._history.shift();
  }

  /**
   * @returns {number} Current drawdown as a fraction of peak equity (0 if no drawdown or no data).
   */
  getCurrentDrawdownPct() {
    if (this._peakEquity === null || this._currentEquity === null || this._peakEquity === 0) return 0;
    return Math.max(0, (this._peakEquity - this._currentEquity) / this._peakEquity);
  }

  /**
   * @returns {boolean} Whether current drawdown has breached the configured max-drawdown threshold.
   */
  isDrawdownExceeded() {
    return this.getCurrentDrawdownPct() >= this._config.maxDrawdownPct;
  }

  /**
   * @returns {boolean} Whether the hard equity-protection ("kill switch") threshold has been breached.
   */
  isEquityProtectionTriggered() {
    return this.getCurrentDrawdownPct() >= this._config.equityProtectionThresholdPct;
  }

  /**
   * @returns {number|null}
   */
  get peakEquity() {
    return this._peakEquity;
  }

  /**
   * @returns {number|null}
   */
  get currentEquity() {
    return this._currentEquity;
  }

  /**
   * Reset all tracked state (e.g. at the start of a new accounting period).
   * @returns {void}
   */
  reset() {
    this._peakEquity = null;
    this._currentEquity = null;
    this._history = [];
  }
}

export default DrawdownManager;
