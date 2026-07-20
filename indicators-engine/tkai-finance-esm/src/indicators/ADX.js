/**
 * @file Average Directional Index (ADX) with +DI/-DI — streaming implementation.
 * @module indicators/ADX
 */

/**
 * @typedef {Object} Candle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} ADXValue
 * @property {number|null} adx - ADX value (null until the second Wilder smoothing window fills).
 * @property {number} plusDI - +DI value.
 * @property {number} minusDI - -DI value.
 */

/**
 * Average Directional Index, including +DI and -DI.
 * Each {@link ADX#update} call is O(1).
 */
export class ADX {
  /**
   * @param {number} [period=14] - Lookback period.
   */
  constructor(period = 14) {
    /** @type {number} */
    this.period = period;
    /** @private */ this._prevHigh = null;
    /** @private */ this._prevLow = null;
    /** @private */ this._prevClose = null;
    /** @private @type {number[]} */ this._trBuf = [];
    /** @private @type {number[]} */ this._plusDMBuf = [];
    /** @private @type {number[]} */ this._minusDMBuf = [];
    /** @private */ this._smoothTR = null;
    /** @private */ this._smoothPlusDM = null;
    /** @private */ this._smoothMinusDM = null;
    /** @private @type {number[]} */ this._dxBuf = [];
    /** @private */ this._adx = null;
    /** @private @type {ADXValue|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {Candle} candle - Latest OHLC candle.
   * @returns {ADXValue|null} Current ADX/+DI/-DI values, or `null` until the first DI window fills.
   */
  update(candle) {
    const { high, low, close } = candle;

    if (this._prevHigh === null) {
      this._prevHigh = high;
      this._prevLow = low;
      this._prevClose = close;
      return null;
    }

    const upMove = high - this._prevHigh;
    const downMove = this._prevLow - low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    const tr = Math.max(
      high - low,
      Math.abs(high - this._prevClose),
      Math.abs(low - this._prevClose)
    );

    this._prevHigh = high;
    this._prevLow = low;
    this._prevClose = close;

    if (this._smoothTR === null) {
      this._trBuf.push(tr);
      this._plusDMBuf.push(plusDM);
      this._minusDMBuf.push(minusDM);
      if (this._trBuf.length < this.period) return null;

      this._smoothTR = this._trBuf.reduce((a, b) => a + b, 0);
      this._smoothPlusDM = this._plusDMBuf.reduce((a, b) => a + b, 0);
      this._smoothMinusDM = this._minusDMBuf.reduce((a, b) => a + b, 0);
    } else {
      this._smoothTR = this._smoothTR - this._smoothTR / this.period + tr;
      this._smoothPlusDM = this._smoothPlusDM - this._smoothPlusDM / this.period + plusDM;
      this._smoothMinusDM = this._smoothMinusDM - this._smoothMinusDM / this.period + minusDM;
    }

    const plusDI = this._smoothTR === 0 ? 0 : (100 * this._smoothPlusDM) / this._smoothTR;
    const minusDI = this._smoothTR === 0 ? 0 : (100 * this._smoothMinusDM) / this._smoothTR;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / diSum;

    if (this._adx === null) {
      this._dxBuf.push(dx);
      if (this._dxBuf.length < this.period) {
        this._value = { adx: null, plusDI, minusDI };
        return this._value;
      }
      this._adx = this._dxBuf.reduce((a, b) => a + b, 0) / this.period;
    } else {
      this._adx = (this._adx * (this.period - 1) + dx) / this.period;
    }

    this._value = { adx: this._adx, plusDI, minusDI };
    return this._value;
  }

  /**
   * Batch helper: compute an ADX series for a full array of candles.
   * @param {Candle[]} candles
   * @param {number} [period=14]
   * @returns {(ADXValue|null)[]}
   */
  static series(candles, period = 14) {
    const adx = new ADX(period);
    return candles.map((c) => adx.update(c));
  }

  /**
   * @returns {ADXValue|null} The most recently computed ADX/+DI/-DI values.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._prevHigh = null;
    this._prevLow = null;
    this._prevClose = null;
    this._trBuf = [];
    this._plusDMBuf = [];
    this._minusDMBuf = [];
    this._smoothTR = null;
    this._smoothPlusDM = null;
    this._smoothMinusDM = null;
    this._dxBuf = [];
    this._adx = null;
    this._value = null;
  }
}

export default ADX;
