/**
 * @file Supertrend — streaming implementation built on top of ATR.
 * @module indicators/Supertrend
 */

import { ATR } from './ATR.js';

/**
 * @typedef {Object} SupertrendCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} SupertrendValue
 * @property {number} value - The Supertrend line value.
 * @property {'up'|'down'} trend - Current trend direction.
 */

/**
 * Supertrend indicator.
 * Wraps an internal streaming {@link ATR}; each {@link Supertrend#update}
 * call is O(1).
 */
export class Supertrend {
  /**
   * @param {number} [period=10] - ATR period.
   * @param {number} [multiplier=3] - ATR band multiplier.
   */
  constructor(period = 10, multiplier = 3) {
    /** @type {number} */
    this.period = period;
    /** @type {number} */
    this.multiplier = multiplier;
    /** @private @type {ATR} */
    this.atr = new ATR(period);
    /** @private */ this._prevClose = null;
    /** @private */ this._prevUpperBand = null;
    /** @private */ this._prevLowerBand = null;
    /** @private */ this._prevSupertrend = null;
    /** @private @type {'up'|'down'|null} */ this._trend = null;
    /** @private @type {SupertrendValue|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {SupertrendCandle} candle
   * @returns {SupertrendValue|null} Current Supertrend value/trend, or `null` until ATR warms up.
   */
  update(candle) {
    const { high, low, close } = candle;
    const atrValue = this.atr.update(candle);
    if (atrValue === null) {
      this._prevClose = close;
      return null;
    }

    const hl2 = (high + low) / 2;
    const basicUpperBand = hl2 + this.multiplier * atrValue;
    const basicLowerBand = hl2 - this.multiplier * atrValue;

    let finalUpperBand = basicUpperBand;
    let finalLowerBand = basicLowerBand;

    if (this._prevUpperBand !== null) {
      finalUpperBand =
        basicUpperBand < this._prevUpperBand || this._prevClose > this._prevUpperBand
          ? basicUpperBand
          : this._prevUpperBand;
      finalLowerBand =
        basicLowerBand > this._prevLowerBand || this._prevClose < this._prevLowerBand
          ? basicLowerBand
          : this._prevLowerBand;
    }

    let trend;
    if (this._prevSupertrend === null) {
      trend = close <= finalUpperBand ? 'down' : 'up';
    } else if (this._prevSupertrend === this._prevUpperBand) {
      trend = close > finalUpperBand ? 'up' : 'down';
    } else {
      trend = close < finalLowerBand ? 'down' : 'up';
    }

    const supertrendValue = trend === 'up' ? finalLowerBand : finalUpperBand;

    this._prevUpperBand = finalUpperBand;
    this._prevLowerBand = finalLowerBand;
    this._prevSupertrend = supertrendValue;
    this._prevClose = close;
    this._trend = trend;

    this._value = { value: supertrendValue, trend };
    return this._value;
  }

  /**
   * Batch helper: compute a Supertrend series for a full array of candles.
   * @param {SupertrendCandle[]} candles
   * @param {number} [period=10]
   * @param {number} [multiplier=3]
   * @returns {(SupertrendValue|null)[]}
   */
  static series(candles, period = 10, multiplier = 3) {
    const st = new Supertrend(period, multiplier);
    return candles.map((c) => st.update(c));
  }

  /**
   * @returns {SupertrendValue|null} The most recently computed Supertrend value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state (including the underlying ATR).
   * @returns {void}
   */
  reset() {
    this.atr.reset();
    this._prevClose = null;
    this._prevUpperBand = null;
    this._prevLowerBand = null;
    this._prevSupertrend = null;
    this._trend = null;
    this._value = null;
  }
}

export default Supertrend;
