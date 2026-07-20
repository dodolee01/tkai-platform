/**
 * @file Average True Range (ATR) — streaming implementation using Wilder's smoothing.
 * @module indicators/ATR
 */

/**
 * @typedef {Object} Candle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * Average True Range (Wilder's smoothing).
 * Each {@link ATR#update} call is O(1).
 */
export class ATR {
  /**
   * @param {number} [period=14] - Lookback period. Must be a positive integer.
   */
  constructor(period = 14) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('ATR: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @type {number|null} @private */
    this._prevClose = null;
    /** @type {number[]} @private */
    this._trValues = [];
    /** @type {number|null} @private */
    this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {Candle} candle - Latest OHLC candle.
   * @returns {number|null} Current ATR value, or `null` until warmed up.
   */
  update(candle) {
    const { high, low, close } = candle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('ATR: high/low/close must be finite numbers');
    }

    let tr;
    if (this._prevClose === null) {
      tr = high - low;
    } else {
      tr = Math.max(
        high - low,
        Math.abs(high - this._prevClose),
        Math.abs(low - this._prevClose)
      );
    }
    this._prevClose = close;

    if (this._value === null) {
      this._trValues.push(tr);
      if (this._trValues.length < this.period) return null;
      this._value = this._trValues.reduce((a, b) => a + b, 0) / this.period;
      return this._value;
    }

    this._value = (this._value * (this.period - 1) + tr) / this.period;
    return this._value;
  }

  /**
   * Batch helper: compute an ATR series for a full array of candles.
   * @param {Candle[]} candles - Array of OHLC candles, oldest first.
   * @param {number} [period=14]
   * @returns {(number|null)[]}
   */
  static series(candles, period = 14) {
    const atr = new ATR(period);
    return candles.map((c) => atr.update(c));
  }

  /**
   * @returns {number|null} The most recently computed ATR value.
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
    this._trValues = [];
    this._value = null;
  }
}

export default ATR;
