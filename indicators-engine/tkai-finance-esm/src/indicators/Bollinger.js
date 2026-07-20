/**
 * @file Bollinger Bands — streaming implementation.
 * @module indicators/Bollinger
 */

/**
 * @typedef {Object} BollingerValue
 * @property {number} middle - Middle band (SMA).
 * @property {number} upper - Upper band.
 * @property {number} lower - Lower band.
 * @property {number} bandwidth - Normalized band width.
 */

/**
 * Bollinger Bands.
 * Maintains a fixed-size rolling window of closes; each
 * {@link Bollinger#update} call is O(period) for the variance
 * calculation, with no re-scan of data outside the window.
 */
export class Bollinger {
  /**
   * @param {number} [period=20] - Lookback period.
   * @param {number} [stdDevMultiplier=2] - Standard deviation multiplier for the bands.
   */
  constructor(period = 20, stdDevMultiplier = 2) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('Bollinger: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @type {number} */
    this.stdDevMultiplier = stdDevMultiplier;
    /** @private @type {number[]} */ this._buf = [];
    /** @private @type {BollingerValue|null} */ this._value = null;
  }

  /**
   * Feed a single new close price (streaming / incremental update).
   * @param {number} close - Latest close price.
   * @returns {BollingerValue|null} Current band values, or `null` until the window fills.
   */
  update(close) {
    if (typeof close !== 'number' || Number.isNaN(close)) {
      throw new Error('Bollinger: close must be a finite number');
    }
    this._buf.push(close);
    if (this._buf.length > this.period) this._buf.shift();
    if (this._buf.length < this.period) return null;

    const mean = this._buf.reduce((a, b) => a + b, 0) / this.period;
    const variance =
      this._buf.reduce((a, b) => a + (b - mean) ** 2, 0) / this.period;
    const stdDev = Math.sqrt(variance);

    this._value = {
      middle: mean,
      upper: mean + this.stdDevMultiplier * stdDev,
      lower: mean - this.stdDevMultiplier * stdDev,
      bandwidth: mean === 0 ? 0 : (2 * this.stdDevMultiplier * stdDev) / mean,
    };
    return this._value;
  }

  /**
   * Batch helper: compute a Bollinger Bands series for a full array of closes.
   * @param {number[]} closes
   * @param {number} [period=20]
   * @param {number} [stdDevMultiplier=2]
   * @returns {(BollingerValue|null)[]}
   */
  static series(closes, period = 20, stdDevMultiplier = 2) {
    const bb = new Bollinger(period, stdDevMultiplier);
    return closes.map((c) => bb.update(c));
  }

  /**
   * @returns {BollingerValue|null} The most recently computed band values.
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

export default Bollinger;
