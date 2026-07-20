/**
 * @file Relative Strength Index (RSI) — streaming implementation using Wilder's smoothing.
 * @module indicators/RSI
 */

/**
 * Relative Strength Index (Wilder's smoothing method).
 * Each {@link RSI#update} call is O(1); no historical recalculation occurs.
 */
export class RSI {
  /**
   * @param {number} [period=14] - Lookback period. Must be a positive integer.
   */
  constructor(period = 14) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('RSI: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @type {number|null} @private */
    this._prevClose = null;
    /** @type {number|null} @private */
    this._avgGain = null;
    /** @type {number|null} @private */
    this._avgLoss = null;
    /** @type {number[]} @private */
    this._gains = [];
    /** @type {number[]} @private */
    this._losses = [];
    /** @type {number|null} @private */
    this._value = null;
  }

  /**
   * Feed a single new close price (streaming / incremental update).
   * @param {number} close - Latest close price.
   * @returns {number|null} Current RSI value in [0, 100], or `null` until warmed up.
   */
  update(close) {
    if (typeof close !== 'number' || Number.isNaN(close)) {
      throw new Error('RSI: close must be a finite number');
    }
    if (this._prevClose === null) {
      this._prevClose = close;
      return null;
    }

    const change = close - this._prevClose;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    this._prevClose = close;

    if (this._avgGain === null) {
      this._gains.push(gain);
      this._losses.push(loss);
      if (this._gains.length < this.period) return null;
      this._avgGain = this._gains.reduce((a, b) => a + b, 0) / this.period;
      this._avgLoss = this._losses.reduce((a, b) => a + b, 0) / this.period;
    } else {
      this._avgGain = (this._avgGain * (this.period - 1) + gain) / this.period;
      this._avgLoss = (this._avgLoss * (this.period - 1) + loss) / this.period;
    }

    if (this._avgLoss === 0) {
      this._value = 100;
      return 100;
    }
    const rs = this._avgGain / this._avgLoss;
    this._value = 100 - 100 / (1 + rs);
    return this._value;
  }

  /**
   * Batch helper: compute an RSI series for a full array of closes.
   * @param {number[]} closes - Array of close prices, oldest first.
   * @param {number} [period=14] - RSI period.
   * @returns {(number|null)[]} RSI value for each input close.
   */
  static series(closes, period = 14) {
    const rsi = new RSI(period);
    return closes.map((c) => rsi.update(c));
  }

  /**
   * @returns {number|null} The most recently computed RSI value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._prevClose = null;
    this._avgGain = null;
    this._avgLoss = null;
    this._gains = [];
    this._losses = [];
    this._value = null;
  }
}

export default RSI;
