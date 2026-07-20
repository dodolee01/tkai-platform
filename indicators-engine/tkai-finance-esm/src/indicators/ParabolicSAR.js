/**
 * @file Parabolic SAR (Stop and Reverse) — streaming implementation.
 * @module indicators/ParabolicSAR
 */

/**
 * @typedef {Object} ParabolicSARCandle
 * @property {number} high
 * @property {number} low
 */

/**
 * @typedef {Object} ParabolicSARValue
 * @property {number} sar - Current SAR level.
 * @property {'up'|'down'} trend - Current trend direction.
 */

/**
 * Parabolic SAR.
 * Each {@link ParabolicSAR#update} call is O(1).
 */
export class ParabolicSAR {
  /**
   * @param {number} [step=0.02] - Acceleration factor step.
   * @param {number} [maxStep=0.2] - Maximum acceleration factor.
   */
  constructor(step = 0.02, maxStep = 0.2) {
    /** @type {number} */ this.step = step;
    /** @type {number} */ this.maxStep = maxStep;
    /** @private */ this._sar = null;
    /** @private */ this._ep = null;
    /** @private */ this._af = step;
    /** @private */ this._isUpTrend = true;
    /** @private */ this._prevHigh = null;
    /** @private */ this._prevLow = null;
    /** @private */ this._initialized = false;
    /** @private @type {ParabolicSARValue|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {ParabolicSARCandle} candle
   * @returns {ParabolicSARValue} Current SAR value and trend.
   */
  update(candle) {
    const { high, low } = candle;
    if ([high, low].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('ParabolicSAR: high/low must be finite numbers');
    }

    if (!this._initialized) {
      this._sar = low;
      this._ep = high;
      this._isUpTrend = true;
      this._af = this.step;
      this._prevHigh = high;
      this._prevLow = low;
      this._initialized = true;
      this._value = { sar: this._sar, trend: 'up' };
      return this._value;
    }

    let sar = this._sar + this._af * (this._ep - this._sar);

    if (this._isUpTrend) {
      sar = Math.min(sar, this._prevLow, low);
      if (high > this._ep) {
        this._ep = high;
        this._af = Math.min(this._af + this.step, this.maxStep);
      }
      if (low < sar) {
        this._isUpTrend = false;
        sar = this._ep;
        this._ep = low;
        this._af = this.step;
      }
    } else {
      sar = Math.max(sar, this._prevHigh, high);
      if (low < this._ep) {
        this._ep = low;
        this._af = Math.min(this._af + this.step, this.maxStep);
      }
      if (high > sar) {
        this._isUpTrend = true;
        sar = this._ep;
        this._ep = high;
        this._af = this.step;
      }
    }

    this._sar = sar;
    this._prevHigh = high;
    this._prevLow = low;

    this._value = { sar: this._sar, trend: this._isUpTrend ? 'up' : 'down' };
    return this._value;
  }

  /**
   * Batch helper: compute a Parabolic SAR series for a full array of candles.
   * @param {ParabolicSARCandle[]} candles
   * @param {number} [step=0.02]
   * @param {number} [maxStep=0.2]
   * @returns {ParabolicSARValue[]}
   */
  static series(candles, step = 0.02, maxStep = 0.2) {
    const psar = new ParabolicSAR(step, maxStep);
    return candles.map((c) => psar.update(c));
  }

  /**
   * @returns {ParabolicSARValue|null} The most recently computed SAR value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._sar = null;
    this._ep = null;
    this._af = this.step;
    this._isUpTrend = true;
    this._prevHigh = null;
    this._prevLow = null;
    this._initialized = false;
    this._value = null;
  }
}

export default ParabolicSAR;
