/**
 * @file Open Interest tracker — streaming implementation.
 * @module indicators/OpenInterest
 */

/**
 * @typedef {Object} OpenInterestSnapshot
 * @property {number} openInterest
 * @property {number} [price]
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} OpenInterestValue
 * @property {number} openInterest - Latest OI value.
 * @property {number} changePct - Percent change of OI across the window.
 * @property {number} zScore - Z-score of the latest OI vs the window mean.
 * @property {'long_buildup'|'short_buildup'|'short_covering'|'long_unwind'|'neutral'} interpretation
 */

/**
 * Open Interest tracker.
 * Consumes raw OI snapshots (e.g. Binance `/futures/data/openInterestHist`
 * or the `openInterest` websocket stream) and derives rate-of-change and
 * z-score signals over a bounded rolling window.
 */
export class OpenInterest {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowSize=50] - Max snapshots retained.
   */
  constructor({ windowSize = 50 } = {}) {
    /** @type {number} */
    this.windowSize = windowSize;
    /** @private @type {{oi:number, price:number|undefined, timestamp:number|undefined}[]} */
    this._buf = [];
    /** @private @type {OpenInterestValue|null} */
    this._value = null;
  }

  /**
   * Feed a single new OI snapshot (streaming / incremental update).
   * @param {OpenInterestSnapshot} snapshot
   * @returns {OpenInterestValue}
   */
  update(snapshot) {
    const { openInterest, price, timestamp } = snapshot;
    if (typeof openInterest !== 'number' || Number.isNaN(openInterest)) {
      throw new Error('OpenInterest: openInterest must be a finite number');
    }

    this._buf.push({ oi: openInterest, price, timestamp });
    if (this._buf.length > this.windowSize) this._buf.shift();

    const first = this._buf[0];
    const last = this._buf[this._buf.length - 1];
    const changePct = first.oi === 0 ? 0 : ((last.oi - first.oi) / first.oi) * 100;

    const oiValues = this._buf.map((b) => b.oi);
    const mean = oiValues.reduce((a, b) => a + b, 0) / oiValues.length;
    const variance =
      oiValues.reduce((a, b) => a + (b - mean) ** 2, 0) / oiValues.length;
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev === 0 ? 0 : (last.oi - mean) / stdDev;

    let interpretation = 'neutral';
    if (this._buf.length >= 2 && typeof first.price === 'number' && typeof last.price === 'number') {
      const priceUp = last.price > first.price;
      const oiUp = last.oi > first.oi;
      if (priceUp && oiUp) interpretation = 'long_buildup';
      else if (!priceUp && oiUp) interpretation = 'short_buildup';
      else if (priceUp && !oiUp) interpretation = 'short_covering';
      else if (!priceUp && !oiUp) interpretation = 'long_unwind';
    }

    this._value = { openInterest: last.oi, changePct, zScore, interpretation };
    return this._value;
  }

  /**
   * @returns {OpenInterestValue|null} The most recently computed value.
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

export default OpenInterest;
