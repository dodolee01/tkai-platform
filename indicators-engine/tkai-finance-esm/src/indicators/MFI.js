/**
 * @file Money Flow Index (MFI) — streaming implementation.
 * @module indicators/MFI
 */

/**
 * @typedef {Object} MFICandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * Money Flow Index.
 * Maintains bounded rolling windows of positive/negative money flow;
 * each {@link MFI#update} call is O(period) for the window sum.
 */
export class MFI {
  /**
   * @param {number} [period=14] - Lookback period.
   */
  constructor(period = 14) {
    if (!Number.isInteger(period) || period < 1) {
      throw new Error('MFI: period must be a positive integer');
    }
    /** @type {number} */
    this.period = period;
    /** @private @type {number|null} */ this._prevTypicalPrice = null;
    /** @private @type {number[]} */ this._posFlowBuf = [];
    /** @private @type {number[]} */ this._negFlowBuf = [];
    /** @private @type {number|null} */ this._value = null;
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {MFICandle} candle
   * @returns {number|null} Current MFI value in [0, 100], or `null` until warmed up.
   */
  update(candle) {
    const { high, low, close, volume } = candle;
    if ([high, low, close, volume].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('MFI: high/low/close/volume must be finite numbers');
    }

    const typicalPrice = (high + low + close) / 3;
    const rawMoneyFlow = typicalPrice * volume;

    if (this._prevTypicalPrice === null) {
      this._prevTypicalPrice = typicalPrice;
      this._posFlowBuf.push(0);
      this._negFlowBuf.push(0);
      return null;
    }

    const posFlow = typicalPrice > this._prevTypicalPrice ? rawMoneyFlow : 0;
    const negFlow = typicalPrice < this._prevTypicalPrice ? rawMoneyFlow : 0;
    this._prevTypicalPrice = typicalPrice;

    this._posFlowBuf.push(posFlow);
    this._negFlowBuf.push(negFlow);
    if (this._posFlowBuf.length > this.period) {
      this._posFlowBuf.shift();
      this._negFlowBuf.shift();
    }
    if (this._posFlowBuf.length < this.period) return null;

    const posSum = this._posFlowBuf.reduce((a, b) => a + b, 0);
    const negSum = this._negFlowBuf.reduce((a, b) => a + b, 0);

    if (negSum === 0) {
      this._value = 100;
      return 100;
    }
    const moneyRatio = posSum / negSum;
    this._value = 100 - 100 / (1 + moneyRatio);
    return this._value;
  }

  /**
   * Batch helper: compute an MFI series for a full array of candles.
   * @param {MFICandle[]} candles
   * @param {number} [period=14]
   * @returns {(number|null)[]}
   */
  static series(candles, period = 14) {
    const mfi = new MFI(period);
    return candles.map((c) => mfi.update(c));
  }

  /**
   * @returns {number|null} The most recently computed MFI value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._prevTypicalPrice = null;
    this._posFlowBuf = [];
    this._negFlowBuf = [];
    this._value = null;
  }
}

export default MFI;
