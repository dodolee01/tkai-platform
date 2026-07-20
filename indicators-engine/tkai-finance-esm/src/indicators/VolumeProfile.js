/**
 * @file Volume Profile — streaming implementation with a bounded rolling window.
 * @module indicators/VolumeProfile
 */

/**
 * @typedef {Object} VolumeProfileCandle
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} VolumeProfileValue
 * @property {number|null} poc - Point of Control (price bucket with most volume).
 * @property {number|null} vah - Value Area High.
 * @property {number|null} val - Value Area Low.
 * @property {number} totalVolume - Total volume across the current window.
 * @property {Object.<string, number>} buckets - Volume per price bucket.
 */

/**
 * Volume Profile.
 * Distributes traded volume across price buckets over a bounded
 * rolling window of candles and exposes the Point of Control (POC)
 * and Value Area High/Low (VAH/VAL).
 */
export class VolumeProfile {
  /**
   * @param {Object} [options]
   * @param {number} [options.bucketSize=1] - Price bucket width.
   * @param {number} [options.windowSize=500] - Max candles retained in the rolling window.
   * @param {number} [options.valueAreaPct=0.7] - Fraction of volume defining the value area.
   */
  constructor({ bucketSize = 1, windowSize = 500, valueAreaPct = 0.7 } = {}) {
    if (bucketSize <= 0) throw new Error('VolumeProfile: bucketSize must be > 0');
    /** @type {number} */ this.bucketSize = bucketSize;
    /** @type {number} */ this.windowSize = windowSize;
    /** @type {number} */ this.valueAreaPct = valueAreaPct;
    /** @private @type {VolumeProfileCandle[]} */ this._candles = [];
    /** @private @type {VolumeProfileValue|null} */ this._value = null;
  }

  /**
   * @param {number} price
   * @returns {number}
   * @private
   */
  _bucketKey(price) {
    return Math.floor(price / this.bucketSize) * this.bucketSize;
  }

  /**
   * Feed a single new candle (streaming update over a bounded window).
   * Recomputes the profile only across the retained window (max `windowSize`
   * candles), never the full unbounded history.
   * @param {VolumeProfileCandle} candle
   * @returns {VolumeProfileValue}
   */
  update(candle) {
    const { high, low, close, volume } = candle;
    if ([high, low, close, volume].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('VolumeProfile: high/low/close/volume must be finite numbers');
    }

    this._candles.push(candle);
    if (this._candles.length > this.windowSize) this._candles.shift();

    const buckets = new Map();
    for (const c of this._candles) {
      const key = this._bucketKey((c.high + c.low + c.close) / 3);
      buckets.set(key, (buckets.get(key) || 0) + c.volume);
    }

    let poc = null;
    let maxVol = -Infinity;
    let totalVol = 0;
    for (const [price, vol] of buckets) {
      totalVol += vol;
      if (vol > maxVol) {
        maxVol = vol;
        poc = price;
      }
    }

    const sortedByVol = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
    let cumVol = 0;
    const valueAreaPrices = [];
    for (const [price, vol] of sortedByVol) {
      cumVol += vol;
      valueAreaPrices.push(price);
      if (cumVol >= totalVol * this.valueAreaPct) break;
    }
    const vah = valueAreaPrices.length ? Math.max(...valueAreaPrices) + this.bucketSize : null;
    const val = valueAreaPrices.length ? Math.min(...valueAreaPrices) : null;

    this._value = { poc, vah, val, totalVolume: totalVol, buckets: Object.fromEntries(buckets) };
    return this._value;
  }

  /**
   * @returns {VolumeProfileValue|null} The most recently computed profile.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._candles = [];
    this._value = null;
  }
}

export default VolumeProfile;
