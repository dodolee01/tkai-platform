/**
 * @file Funding Rate tracker — streaming implementation.
 * @module indicators/Funding
 */

/**
 * @typedef {Object} FundingSnapshot
 * @property {number} fundingRate
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} FundingValue
 * @property {number} currentRate
 * @property {number} averageRate
 * @property {'crowded_long'|'crowded_short'|'neutral'} bias
 * @property {'rising'|'falling'|'flat'} trend
 * @property {number} annualizedPct - Annualized rate assuming an 8h funding interval.
 */

/**
 * Funding Rate tracker.
 * Consumes funding rate updates (e.g. Binance markPrice/fundingRate
 * stream) over a bounded rolling window and derives extremity/trend
 * signals used to gauge crowd positioning bias.
 */
export class Funding {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowSize=24] - Max snapshots retained.
   * @param {number} [options.extremeThreshold=0.0005] - Rate magnitude considered "crowded".
   */
  constructor({ windowSize = 24, extremeThreshold = 0.0005 } = {}) {
    /** @type {number} */ this.windowSize = windowSize;
    /** @type {number} */ this.extremeThreshold = extremeThreshold;
    /** @private @type {{rate:number, timestamp:number|undefined}[]} */ this._buf = [];
    /** @private @type {FundingValue|null} */ this._value = null;
  }

  /**
   * Feed a single new funding rate snapshot (streaming / incremental update).
   * @param {FundingSnapshot} snapshot
   * @returns {FundingValue}
   */
  update(snapshot) {
    const { fundingRate, timestamp } = snapshot;
    if (typeof fundingRate !== 'number' || Number.isNaN(fundingRate)) {
      throw new Error('Funding: fundingRate must be a finite number');
    }

    this._buf.push({ rate: fundingRate, timestamp });
    if (this._buf.length > this.windowSize) this._buf.shift();

    const rates = this._buf.map((b) => b.rate);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    let bias = 'neutral';
    if (fundingRate > this.extremeThreshold) bias = 'crowded_long';
    else if (fundingRate < -this.extremeThreshold) bias = 'crowded_short';

    const trend =
      rates.length >= 2 ? (rates[rates.length - 1] - rates[0] > 0 ? 'rising' : 'falling') : 'flat';

    this._value = {
      currentRate: fundingRate,
      averageRate: avgRate,
      bias,
      trend,
      annualizedPct: fundingRate * 3 * 365 * 100,
    };
    return this._value;
  }

  /**
   * @returns {FundingValue|null} The most recently computed value.
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

export default Funding;
