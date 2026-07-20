/**
 * @file Simple Moving Average (SMA) — streaming implementation.
 * @module indicators/SMA
 */

/**
 * Simple Moving Average.
 * Maintains a rolling sum so each {@link SMA#update} call is O(1)
 * regardless of period length or history size.
 */
export class SMA {
  /**
   * @param {number} period - Lookback period. Must be a positive integer.
   */
  constructor(period) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('SMA: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @type {number[]} @private */
    this._buffer = [];
    /** @type {number} @private */
    this._sum = 0;
  }

  /**
   * Feed a single new close price (streaming / incremental update).
   * @param {number} close - Latest close price.
   * @returns {number|null} Current SMA value, or `null` until the window is filled.
   */
  update(close) {
    if (typeof close !== 'number' || Number.isNaN(close)) {
      throw new Error('SMA: close must be a finite number');
    }
    this._buffer.push(close);
    this._sum += close;
    if (this._buffer.length > this.period) {
      this._sum -= this._buffer.shift();
    }
    if (this._buffer.length < this.period) return null;
    return this._sum / this.period;
  }

  /**
   * Batch helper: compute an SMA series for a full array of closes.
   * @param {number[]} closes - Array of close prices, oldest first.
   * @param {number} period - SMA period.
   * @returns {(number|null)[]} SMA value for each input close (null while filling).
   */
  static series(closes, period) {
    const sma = new SMA(period);
    return closes.map((c) => sma.update(c));
  }

  /**
   * @returns {number|null} The most recently computed SMA value.
   */
  get value() {
    if (this._buffer.length < this.period) return null;
    return this._sum / this.period;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._buffer = [];
    this._sum = 0;
  }
}

export default SMA;
