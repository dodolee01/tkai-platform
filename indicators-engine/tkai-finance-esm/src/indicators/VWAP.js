/**
 * @file Volume Weighted Average Price (VWAP) — streaming implementation.
 * @module indicators/VWAP
 */

/**
 * @typedef {Object} VWAPCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 * @property {number} [timestamp] - Unix ms timestamp, required if resetDaily is true.
 */

/**
 * Volume Weighted Average Price.
 * Maintains running cumulative price*volume and volume sums, so each
 * {@link VWAP#update} call is O(1). Resets automatically at each new
 * UTC session day when `resetDaily` is enabled.
 */
export class VWAP {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.resetDaily=true] - Reset accumulators at each new UTC day.
   */
  constructor({ resetDaily = true } = {}) {
    /** @type {boolean} */
    this.resetDaily = resetDaily;
    /** @private */ this._cumPV = 0;
    /** @private */ this._cumVolume = 0;
    /** @private */ this._currentDay = null;
    /** @private @type {number|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {VWAPCandle} candle
   * @returns {number|null} Current VWAP value, or `null` if no volume has accumulated.
   */
  update(candle) {
    const { high, low, close, volume, timestamp } = candle;
    if ([high, low, close, volume].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('VWAP: high/low/close/volume must be finite numbers');
    }

    if (this.resetDaily && typeof timestamp === 'number') {
      const day = Math.floor(timestamp / 86400000);
      if (this._currentDay !== null && day !== this._currentDay) {
        this._cumPV = 0;
        this._cumVolume = 0;
      }
      this._currentDay = day;
    }

    const typicalPrice = (high + low + close) / 3;
    this._cumPV += typicalPrice * volume;
    this._cumVolume += volume;

    this._value = this._cumVolume === 0 ? null : this._cumPV / this._cumVolume;
    return this._value;
  }

  /**
   * Batch helper: compute a VWAP series for a full array of candles.
   * @param {VWAPCandle[]} candles
   * @param {Object} [options]
   * @returns {(number|null)[]}
   */
  static series(candles, options = {}) {
    const vwap = new VWAP(options);
    return candles.map((c) => vwap.update(c));
  }

  /**
   * @returns {number|null} The most recently computed VWAP value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._cumPV = 0;
    this._cumVolume = 0;
    this._currentDay = null;
    this._value = null;
  }
}

export default VWAP;
