/**
 * @file Williams %R — streaming implementation.
 * @module indicators/WilliamsR
 */

/**
 * @typedef {Object} WilliamsRCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * Williams %R.
 * Maintains bounded rolling windows of highs/lows; each
 * {@link WilliamsR#update} call is O(period) for the min/max scan.
 */
export class WilliamsR {
  /**
   * @param {number} [period=14] - Lookback period.
   */
  constructor(period = 14) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('WilliamsR: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @private @type {number[]} */ this._highBuf = [];
    /** @private @type {number[]} */ this._lowBuf = [];
    /** @private @type {number|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {WilliamsRCandle} candle
   * @returns {number|null} Current %R value in [-100, 0], or `null` until the window fills.
   */
  update(candle) {
    const { high, low, close } = candle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('WilliamsR: high/low/close must be finite numbers');
    }

    this._highBuf.push(high);
    this._lowBuf.push(low);
    if (this._highBuf.length > this.period) {
      this._highBuf.shift();
      this._lowBuf.shift();
    }
    if (this._highBuf.length < this.period) return null;

    const highestHigh = Math.max(...this._highBuf);
    const lowestLow = Math.min(...this._lowBuf);
    const range = highestHigh - lowestLow;

    // The "+ 0" normalizes a JS -0 result (e.g. 0 * -100 === -0) to a clean 0.
    this._value = range === 0 ? -50 : ((highestHigh - close) / range) * -100 + 0;
    return this._value;
  }

  /**
   * Batch helper: compute a Williams %R series for a full array of candles.
   * @param {WilliamsRCandle[]} candles
   * @param {number} [period=14]
   * @returns {(number|null)[]}
   */
  static series(candles, period = 14) {
    const wr = new WilliamsR(period);
    return candles.map((c) => wr.update(c));
  }

  /**
   * @returns {number|null} The most recently computed %R value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._highBuf = [];
    this._lowBuf = [];
    this._value = null;
  }
}

export default WilliamsR;
