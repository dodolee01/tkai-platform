/**
 * @file Moving Average Convergence Divergence (MACD) — streaming implementation.
 * @module indicators/MACD
 */

import { EMA } from './EMA.js';

/**
 * @typedef {Object} MACDValue
 * @property {number} macd - Fast EMA minus slow EMA.
 * @property {number} signal - EMA of the MACD line.
 * @property {number} histogram - MACD line minus signal line.
 */

/**
 * Moving Average Convergence Divergence.
 * Composed of three internal streaming EMAs; each {@link MACD#update}
 * call is O(1).
 */
export class MACD {
  /**
   * @param {number} [fastPeriod=12] - Fast EMA period.
   * @param {number} [slowPeriod=26] - Slow EMA period.
   * @param {number} [signalPeriod=9] - Signal line EMA period.
   */
  constructor(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    /** @type {EMA} @private */
    this.fastEMA = new EMA(fastPeriod);
    /** @type {EMA} @private */
    this.slowEMA = new EMA(slowPeriod);
    /** @type {EMA} @private */
    this.signalEMA = new EMA(signalPeriod);
    /** @type {MACDValue|null} @private */
    this._value = null;
  }

  /**
   * Feed a single new close price (streaming / incremental update).
   * @param {number} close - Latest close price.
   * @returns {MACDValue|null} Current MACD value, or `null` until warmed up.
   */
  update(close) {
    const fast = this.fastEMA.update(close);
    const slow = this.slowEMA.update(close);
    if (fast === null || slow === null) return null;

    const macdLine = fast - slow;
    const signalLine = this.signalEMA.update(macdLine);
    if (signalLine === null) return null;

    const histogram = macdLine - signalLine;
    this._value = { macd: macdLine, signal: signalLine, histogram };
    return this._value;
  }

  /**
   * Batch helper: compute a MACD series for a full array of closes.
   * @param {number[]} closes - Array of close prices, oldest first.
   * @param {number} [fastPeriod=12]
   * @param {number} [slowPeriod=26]
   * @param {number} [signalPeriod=9]
   * @returns {(MACDValue|null)[]}
   */
  static series(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const macd = new MACD(fastPeriod, slowPeriod, signalPeriod);
    return closes.map((c) => macd.update(c));
  }

  /**
   * @returns {MACDValue|null} The most recently computed MACD value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state (including the three underlying EMAs).
   * @returns {void}
   */
  reset() {
    this.fastEMA.reset();
    this.slowEMA.reset();
    this.signalEMA.reset();
    this._value = null;
  }
}

export default MACD;
