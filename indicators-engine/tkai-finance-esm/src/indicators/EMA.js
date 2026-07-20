/**
 * @file Exponential Moving Average (EMA) — streaming implementation.
 * @module indicators/EMA
 */

/**
 * Exponential Moving Average.
 * A weighted moving average that gives more weight to recent prices.
 * Supports true streaming: each call to {@link EMA#update} performs
 * O(1) work and never re-scans historical data.
 */
export class EMA {
  /**
   * @param {number} period - Lookback period (e.g. 9, 21, 50, 200). Must be a positive integer.
   */
  constructor(period) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('EMA: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @type {number} */
    this.multiplier = 2 / (period + 1);
    /** @type {number|null} @private */
    this._value = null;
    /** @type {number[]|null} @private */
    this._seedBuffer = [];
  }

  /**
   * Feed a single new close price (streaming / incremental update).
   * Does not recompute over prior history — O(1) per call.
   * @param {number} close - Latest close price.
   * @returns {number|null} Current EMA value, or `null` until the seed period is filled.
   */
  update(close) {
    if (typeof close !== 'number' || Number.isNaN(close)) {
      throw new Error('EMA: close must be a finite number');
    }

    if (this._value === null) {
      this._seedBuffer.push(close);
      if (this._seedBuffer.length < this.period) {
        return null;
      }
      const seedSum = this._seedBuffer.reduce((a, b) => a + b, 0);
      this._value = seedSum / this.period;
      this._seedBuffer = null;
      return this._value;
    }

    this._value = (close - this._value) * this.multiplier + this._value;
    return this._value;
  }

  /**
   * Batch helper: compute an EMA series for a full array of closes.
   * Creates a fresh internal state; does not affect any existing instance.
   * @param {number[]} closes - Array of close prices, oldest first.
   * @param {number} period - EMA period.
   * @returns {(number|null)[]} EMA value for each input close (null while seeding).
   */
  static series(closes, period) {
    const ema = new EMA(period);
    return closes.map((c) => ema.update(c));
  }

  /**
   * @returns {number|null} The most recently computed EMA value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state, returning the instance to its initial condition.
   * @returns {void}
   */
  reset() {
    this._value = null;
    this._seedBuffer = [];
  }
}

export default EMA;
