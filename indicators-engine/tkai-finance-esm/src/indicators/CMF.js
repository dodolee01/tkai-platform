/**
 * @file Chaikin Money Flow (CMF) — streaming implementation.
 * @module indicators/CMF
 */

/**
 * @typedef {Object} CMFCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * Chaikin Money Flow.
 * Maintains a fixed-size rolling window; each {@link CMF#update} call
 * is O(1) amortized (single push/shift on a bounded array).
 */
export class CMF {
  /**
   * @param {number} [period=20] - Lookback period.
   */
  constructor(period = 20) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('CMF: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @private @type {number[]} */ this._mfvBuf = [];
    /** @private @type {number[]} */ this._volBuf = [];
    /** @private @type {number|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {CMFCandle} candle
   * @returns {number|null} Current CMF value in [-1, 1], or `null` until the window fills.
   */
  update(candle) {
    const { high, low, close, volume } = candle;
    if ([high, low, close, volume].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('CMF: high/low/close/volume must be finite numbers');
    }

    const range = high - low;
    const mfMultiplier = range === 0 ? 0 : ((close - low) - (high - close)) / range;
    const mfVolume = mfMultiplier * volume;

    this._mfvBuf.push(mfVolume);
    this._volBuf.push(volume);
    if (this._mfvBuf.length > this.period) {
      this._mfvBuf.shift();
      this._volBuf.shift();
    }
    if (this._mfvBuf.length < this.period) return null;

    const mfvSum = this._mfvBuf.reduce((a, b) => a + b, 0);
    const volSum = this._volBuf.reduce((a, b) => a + b, 0);
    this._value = volSum === 0 ? 0 : mfvSum / volSum;
    return this._value;
  }

  /**
   * Batch helper: compute a CMF series for a full array of candles.
   * @param {CMFCandle[]} candles
   * @param {number} [period=20]
   * @returns {(number|null)[]}
   */
  static series(candles, period = 20) {
    const cmf = new CMF(period);
    return candles.map((c) => cmf.update(c));
  }

  /**
   * @returns {number|null} The most recently computed CMF value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._mfvBuf = [];
    this._volBuf = [];
    this._value = null;
  }
}

export default CMF;
