/**
 * @file Volume Delta (aggressor buy vs sell volume) — streaming implementation.
 * @module indicators/Delta
 */

/**
 * @typedef {Object} DeltaTrade
 * @property {number} quantity
 * @property {boolean} isBuyerMaker - True if the trade matched a resting bid (aggressive sell).
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} DeltaValue
 * @property {number} cumulativeDelta - Running total delta since the last reset.
 * @property {number} windowDelta - Delta within the bounded rolling window.
 * @property {number} buyVolume - Aggressive buy volume within the window.
 * @property {number} sellVolume - Aggressive sell volume within the window.
 * @property {number} ratio - buyVolume / sellVolume (Infinity if sellVolume is 0).
 */

/**
 * Volume Delta.
 * Computed from aggregated trade streams (e.g. Binance `@aggTrade`).
 * Maintains a bounded rolling window; each {@link Delta#update} call
 * is O(window) for the window aggregation, with O(1) cumulative update.
 */
export class Delta {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowSize=500] - Max trades retained in the rolling window.
   */
  constructor({ windowSize = 500 } = {}) {
    /** @type {number} */ this.windowSize = windowSize;
    /** @private @type {{delta:number, timestamp:number|undefined}[]} */ this._buf = [];
    /** @private @type {number} */ this._cumulativeDelta = 0;
    /** @private @type {DeltaValue|null} */ this._value = null;
  }

  /**
   * Feed a single new aggregated trade (streaming / incremental update).
   * @param {DeltaTrade} trade
   * @returns {DeltaValue}
   */
  update(trade) {
    const { quantity, isBuyerMaker, timestamp } = trade;
    if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
      throw new Error('Delta: quantity must be a finite number');
    }
    if (typeof isBuyerMaker !== 'boolean') {
      throw new Error('Delta: isBuyerMaker must be a boolean');
    }

    const signedVolume = isBuyerMaker ? -quantity : quantity;
    this._cumulativeDelta += signedVolume;

    this._buf.push({ delta: signedVolume, timestamp });
    if (this._buf.length > this.windowSize) this._buf.shift();

    const windowDelta = this._buf.reduce((a, b) => a + b.delta, 0);
    const buyVolume = this._buf.filter((b) => b.delta > 0).reduce((a, b) => a + b.delta, 0);
    const sellVolume = this._buf.filter((b) => b.delta < 0).reduce((a, b) => a + -b.delta, 0);

    this._value = {
      cumulativeDelta: this._cumulativeDelta,
      windowDelta,
      buyVolume,
      sellVolume,
      ratio: sellVolume === 0 ? Infinity : buyVolume / sellVolume,
    };
    return this._value;
  }

  /**
   * @returns {DeltaValue|null} The most recently computed value.
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
    this._cumulativeDelta = 0;
    this._value = null;
  }
}

export default Delta;
