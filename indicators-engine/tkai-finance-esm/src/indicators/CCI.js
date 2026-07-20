/**
 * @file Commodity Channel Index (CCI) — streaming implementation.
 * @module indicators/CCI
 */

/**
 * @typedef {Object} CCICandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * Commodity Channel Index.
 * Maintains a fixed-size rolling window of typical prices; each
 * {@link CCI#update} call is O(period) due to the mean-deviation
 * calculation, with no re-scan of data outside the window.
 */
export class CCI {
  /**
   * @param {number} [period=20] - Lookback period.
   */
  constructor(period = 20) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('CCI: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @private @type {number[]} */ this._buf = [];
    /** @private @type {number|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {CCICandle} candle
   * @returns {number|null} Current CCI value, or `null` until the window fills.
   */
  update(candle) {
    const { high, low, close } = candle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('CCI: high/low/close must be finite numbers');
    }

    const typicalPrice = (high + low + close) / 3;
    this._buf.push(typicalPrice);
    if (this._buf.length > this.period) this._buf.shift();
    if (this._buf.length < this.period) return null;

    const sma = this._buf.reduce((a, b) => a + b, 0) / this.period;
    const meanDeviation =
      this._buf.reduce((a, b) => a + Math.abs(b - sma), 0) / this.period;

    this._value = meanDeviation === 0 ? 0 : (typicalPrice - sma) / (0.015 * meanDeviation);
    return this._value;
  }

  /**
   * Batch helper: compute a CCI series for a full array of candles.
   * @param {CCICandle[]} candles
   * @param {number} [period=20]
   * @returns {(number|null)[]}
   */
  static series(candles, period = 20) {
    const cci = new CCI(period);
    return candles.map((c) => cci.update(c));
  }

  /**
   * @returns {number|null} The most recently computed CCI value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._buf = [];
    this._value = null;
  }
}

export default CCI;
