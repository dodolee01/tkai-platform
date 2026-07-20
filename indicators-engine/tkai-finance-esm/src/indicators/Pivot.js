/**
 * @file Pivot Points (standard / fibonacci / camarilla) — stateless-per-period calculator.
 * @module indicators/Pivot
 */

/**
 * @typedef {Object} PivotCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} PivotValue
 * @property {number} pp - Pivot point.
 * @property {number} r1
 * @property {number} r2
 * @property {number} r3
 * @property {number} s1
 * @property {number} s2
 * @property {number} s3
 */

/**
 * Pivot Points.
 * Computed from a single prior-period candle (high/low/close) — feed
 * one candle per period (e.g. once per day for daily pivots).
 * Each {@link Pivot#update} call is O(1).
 */
export class Pivot {
  /**
   * @param {Object} [options]
   * @param {'standard'|'fibonacci'|'camarilla'} [options.method='standard']
   */
  constructor({ method = 'standard' } = {}) {
    /** @type {'standard'|'fibonacci'|'camarilla'} */
    this.method = method;
    /** @private @type {PivotValue|null} */
    this._value = null;
  }

  /**
   * Feed the prior period's candle and compute this period's pivot levels.
   * @param {PivotCandle} priorCandle - The completed candle for the prior period.
   * @returns {PivotValue}
   */
  update(priorCandle) {
    const { high, low, close } = priorCandle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('Pivot: high/low/close must be finite numbers');
    }

    let pp, r1, r2, r3, s1, s2, s3;

    if (this.method === 'fibonacci') {
      pp = (high + low + close) / 3;
      const range = high - low;
      r1 = pp + 0.382 * range;
      r2 = pp + 0.618 * range;
      r3 = pp + 1.0 * range;
      s1 = pp - 0.382 * range;
      s2 = pp - 0.618 * range;
      s3 = pp - 1.0 * range;
    } else if (this.method === 'camarilla') {
      const range = high - low;
      pp = (high + low + close) / 3;
      r1 = close + (range * 1.1) / 12;
      r2 = close + (range * 1.1) / 6;
      r3 = close + (range * 1.1) / 4;
      s1 = close - (range * 1.1) / 12;
      s2 = close - (range * 1.1) / 6;
      s3 = close - (range * 1.1) / 4;
    } else {
      pp = (high + low + close) / 3;
      r1 = 2 * pp - low;
      s1 = 2 * pp - high;
      r2 = pp + (high - low);
      s2 = pp - (high - low);
      r3 = high + 2 * (pp - low);
      s3 = low - 2 * (high - pp);
    }

    this._value = { pp, r1, r2, r3, s1, s2, s3 };
    return this._value;
  }

  /**
   * @returns {PivotValue|null} The most recently computed pivot levels.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._value = null;
  }
}

export default Pivot;
