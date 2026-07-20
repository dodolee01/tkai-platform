/**
 * @file Donchian Channel — streaming implementation.
 * @module indicators/Donchian
 */

/**
 * @typedef {Object} DonchianCandle
 * @property {number} high
 * @property {number} low
 */

/**
 * @typedef {Object} DonchianValue
 * @property {number} upper - Highest high over the period.
 * @property {number} lower - Lowest low over the period.
 * @property {number} middle - Midpoint of upper and lower.
 */

/**
 * Donchian Channel.
 * Maintains fixed-size rolling windows of highs/lows; each
 * {@link Donchian#update} call is O(period) for the min/max scan,
 * bounded strictly to the configured window.
 */
export class Donchian {
  /**
   * @param {number} [period=20] - Lookback period.
   */
  constructor(period = 20) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('Donchian: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @private @type {number[]} */ this._highBuf = [];
    /** @private @type {number[]} */ this._lowBuf = [];
    /** @private @type {DonchianValue|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {DonchianCandle} candle
   * @returns {DonchianValue|null} Current channel values, or `null` until the window fills.
   */
  update(candle) {
    const { high, low } = candle;
    if ([high, low].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('Donchian: high/low must be finite numbers');
    }

    this._highBuf.push(high);
    this._lowBuf.push(low);
    if (this._highBuf.length > this.period) {
      this._highBuf.shift();
      this._lowBuf.shift();
    }
    if (this._highBuf.length < this.period) return null;

    const upper = Math.max(...this._highBuf);
    const lower = Math.min(...this._lowBuf);
    this._value = { upper, lower, middle: (upper + lower) / 2 };
    return this._value;
  }

  /**
   * Batch helper: compute a Donchian Channel series for a full array of candles.
   * @param {DonchianCandle[]} candles
   * @param {number} [period=20]
   * @returns {(DonchianValue|null)[]}
   */
  static series(candles, period = 20) {
    const dc = new Donchian(period);
    return candles.map((c) => dc.update(c));
  }

  /**
   * @returns {DonchianValue|null} The most recently computed channel values.
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

export default Donchian;
