/**
 * @file Ichimoku Kinko Hyo — streaming implementation.
 * @module indicators/Ichimoku
 */

/**
 * @typedef {Object} IchimokuCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 */

/**
 * @typedef {Object} IchimokuValue
 * @property {number|null} tenkanSen - Conversion line.
 * @property {number|null} kijunSen - Base line.
 * @property {number|null} senkouSpanA - Leading span A (plotted `displacement` periods ahead by convention).
 * @property {number|null} senkouSpanB - Leading span B (plotted `displacement` periods ahead by convention).
 * @property {number|null} chikouSpan - Lagging span (current close plotted `displacement` periods back).
 */

/**
 * Ichimoku Kinko Hyo.
 * Maintains a bounded rolling window of candles (sized to the
 * largest configured period); each {@link Ichimoku#update} call
 * scans only that bounded window, never full history.
 */
export class Ichimoku {
  /**
   * @param {number} [tenkanPeriod=9]
   * @param {number} [kijunPeriod=26]
   * @param {number} [senkouSpanBPeriod=52]
   * @param {number} [displacement=26]
   */
  constructor(tenkanPeriod = 9, kijunPeriod = 26, senkouSpanBPeriod = 52, displacement = 26) {
    /** @type {number} */ this.tenkanPeriod = tenkanPeriod;
    /** @type {number} */ this.kijunPeriod = kijunPeriod;
    /** @type {number} */ this.senkouSpanBPeriod = senkouSpanBPeriod;
    /** @type {number} */ this.displacement = displacement;
    /** @private @type {IchimokuCandle[]} */ this._buf = [];
    /** @private @type {number[]} */ this._chikouBuf = [];
    /** @private @type {IchimokuValue|null} */ this._value = null;
  }

  /**
   * @param {number} period
   * @returns {{highest:number, lowest:number}}
   * @private
   */
  _highLow(period) {
    const window = this._buf.slice(-period);
    const highs = window.map((c) => c.high);
    const lows = window.map((c) => c.low);
    return { highest: Math.max(...highs), lowest: Math.min(...lows) };
  }

  /**
   * Feed a single new candle (streaming / incremental update).
   * @param {IchimokuCandle} candle
   * @returns {IchimokuValue} Current Ichimoku component values (fields are null until each warms up).
   */
  update(candle) {
    const { high, low, close } = candle;
    if ([high, low, close].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('Ichimoku: high/low/close must be finite numbers');
    }

    this._buf.push({ high, low, close });
    const maxLen = this.senkouSpanBPeriod;
    if (this._buf.length > maxLen) this._buf.shift();

    let tenkanSen = null;
    let kijunSen = null;
    let senkouSpanA = null;
    let senkouSpanB = null;

    if (this._buf.length >= this.tenkanPeriod) {
      const { highest, lowest } = this._highLow(this.tenkanPeriod);
      tenkanSen = (highest + lowest) / 2;
    }
    if (this._buf.length >= this.kijunPeriod) {
      const { highest, lowest } = this._highLow(this.kijunPeriod);
      kijunSen = (highest + lowest) / 2;
    }
    if (tenkanSen !== null && kijunSen !== null) {
      senkouSpanA = (tenkanSen + kijunSen) / 2;
    }
    if (this._buf.length >= this.senkouSpanBPeriod) {
      const { highest, lowest } = this._highLow(this.senkouSpanBPeriod);
      senkouSpanB = (highest + lowest) / 2;
    }

    this._chikouBuf.push(close);
    if (this._chikouBuf.length > this.displacement + 1) this._chikouBuf.shift();
    const chikouSpan =
      this._chikouBuf.length > this.displacement
        ? this._chikouBuf[this._chikouBuf.length - 1 - this.displacement]
        : null;

    this._value = { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
    return this._value;
  }

  /**
   * Batch helper: compute an Ichimoku series for a full array of candles.
   * @param {IchimokuCandle[]} candles
   * @param {number} [tenkanPeriod=9]
   * @param {number} [kijunPeriod=26]
   * @param {number} [senkouSpanBPeriod=52]
   * @param {number} [displacement=26]
   * @returns {IchimokuValue[]}
   */
  static series(candles, tenkanPeriod = 9, kijunPeriod = 26, senkouSpanBPeriod = 52, displacement = 26) {
    const ichimoku = new Ichimoku(tenkanPeriod, kijunPeriod, senkouSpanBPeriod, displacement);
    return candles.map((c) => ichimoku.update(c));
  }

  /**
   * @returns {IchimokuValue|null} The most recently computed values.
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
    this._chikouBuf = [];
    this._value = null;
  }
}

export default Ichimoku;
