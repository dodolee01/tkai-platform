/**
 * @file Stochastic Oscillator (%K, %D) — streaming implementation.
 * @module indicators/Stochastic
 */

/**
 * @typedef {Object} StochasticCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} StochasticValue
 * @property {number} k - Smoothed %K.
 * @property {number|null} d - %D (SMA of %K), null until warmed up.
 */

/**
 * Stochastic Oscillator.
 * Maintains bounded rolling windows for highs/lows/%K; each
 * {@link Stochastic#update} call is O(kPeriod) for the min/max scan.
 */
export class Stochastic {
  /**
   * @param {number} [kPeriod=14]
   * @param {number} [kSmoothing=3]
   * @param {number} [dPeriod=3]
   */
  constructor(kPeriod = 14, kSmoothing = 3, dPeriod = 3) {
    /** @type {number} */ this.kPeriod = kPeriod;
    /** @type {number} */ this.kSmoothing = kSmoothing;
    /** @type {number} */ this.dPeriod = dPeriod;
    /** @private @type {number[]} */ this._highBuf = [];
    /** @private @type {number[]} */ this._lowBuf = [];
    /** @private @type {number[]} */ this._rawKBuf = [];
    /** @private @type {number[]} */ this._kBuf = [];
    /** @private @type {StochasticValue|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {StochasticCandle} candle
   * @returns {StochasticValue|null} Current %K/%D, or `null` until warmed up.
   */
  update(candle) {
    const { high, low, close } = candle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('Stochastic: high/low/close must be finite numbers');
    }

    this._highBuf.push(high);
    this._lowBuf.push(low);
    if (this._highBuf.length > this.kPeriod) {
      this._highBuf.shift();
      this._lowBuf.shift();
    }
    if (this._highBuf.length < this.kPeriod) return null;

    const highestHigh = Math.max(...this._highBuf);
    const lowestLow = Math.min(...this._lowBuf);
    const range = highestHigh - lowestLow;
    const rawK = range === 0 ? 50 : ((close - lowestLow) / range) * 100;

    this._rawKBuf.push(rawK);
    if (this._rawKBuf.length > this.kSmoothing) this._rawKBuf.shift();
    if (this._rawKBuf.length < this.kSmoothing) return null;
    const smoothedK = this._rawKBuf.reduce((a, b) => a + b, 0) / this.kSmoothing;

    this._kBuf.push(smoothedK);
    if (this._kBuf.length > this.dPeriod) this._kBuf.shift();
    const d =
      this._kBuf.length < this.dPeriod
        ? null
        : this._kBuf.reduce((a, b) => a + b, 0) / this.dPeriod;

    this._value = { k: smoothedK, d };
    return this._value;
  }

  /**
   * Batch helper: compute a Stochastic series for a full array of candles.
   * @param {StochasticCandle[]} candles
   * @param {number} [kPeriod=14]
   * @param {number} [kSmoothing=3]
   * @param {number} [dPeriod=3]
   * @returns {(StochasticValue|null)[]}
   */
  static series(candles, kPeriod = 14, kSmoothing = 3, dPeriod = 3) {
    const st = new Stochastic(kPeriod, kSmoothing, dPeriod);
    return candles.map((c) => st.update(c));
  }

  /**
   * @returns {StochasticValue|null} The most recently computed %K/%D.
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
    this._rawKBuf = [];
    this._kBuf = [];
    this._value = null;
  }
}

export default Stochastic;
