/**
 * @file On-Balance Volume (OBV) — streaming implementation.
 * @module indicators/OBV
 */

/**
 * @typedef {Object} OBVCandle
 * @property {number} close
 * @property {number} volume
 */

/**
 * On-Balance Volume.
 * Each {@link OBV#update} call is O(1).
 */
export class OBV {
  constructor() {
    /** @private @type {number|null} */ this._prevClose = null;
    /** @private @type {number} */ this._value = 0;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {OBVCandle} candle
   * @returns {number} Current cumulative OBV value.
   */
  update(candle) {
    const { close, volume } = candle;
    if (typeof close !== 'number' || typeof volume !== 'number') {
      throw new Error('OBV: close/volume must be finite numbers');
    }

    if (this._prevClose === null) {
      this._prevClose = close;
      return this._value;
    }

    if (close > this._prevClose) {
      this._value += volume;
    } else if (close < this._prevClose) {
      this._value -= volume;
    }
    this._prevClose = close;
    return this._value;
  }

  /**
   * Batch helper: compute an OBV series for a full array of candles.
   * @param {OBVCandle[]} candles
   * @returns {number[]}
   */
  static series(candles) {
    const obv = new OBV();
    return candles.map((c) => obv.update(c));
  }

  /**
   * @returns {number} The current cumulative OBV value.
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
    this._value = 0;
  }
}

export default OBV;
