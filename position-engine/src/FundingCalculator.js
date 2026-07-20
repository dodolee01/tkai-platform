/**
 * @file Funding fee accumulation for perpetual futures positions.
 * @module position-engine/FundingCalculator
 */

/**
 * Compute the funding payment for a single funding event.
 * Convention (matches Binance USDⓈ-M): a LONG position pays funding
 * when the rate is positive and receives it when negative; a SHORT
 * position is the mirror image.
 * @param {'LONG'|'SHORT'} side
 * @param {number} notional - Position notional at the funding timestamp.
 * @param {number} fundingRate - e.g. 0.0001 for 0.01%.
 * @returns {number} Negative = paid out, positive = received.
 */
export function computeFundingPayment(side, notional, fundingRate) {
  const signedRate = side === 'LONG' ? -fundingRate : fundingRate;
  return notional * signedRate;
}

/**
 * Accumulates funding payments over the life of a position.
 */
export class FundingCalculator {
  constructor() {
    /** @private @type {{timestamp:number, amount:number, rate:number}[]} */
    this._events = [];
  }

  /**
   * Record a funding event and return the cumulative total so far.
   * @param {'LONG'|'SHORT'} side
   * @param {number} notional
   * @param {number} fundingRate
   * @param {number} [timestamp=Date.now()]
   * @returns {number} Cumulative funding fees (negative = net paid).
   */
  recordFundingEvent(side, notional, fundingRate, timestamp = Date.now()) {
    const amount = computeFundingPayment(side, notional, fundingRate);
    this._events.push({ timestamp, amount, rate: fundingRate });
    return this.getCumulativeFunding();
  }

  /**
   * @returns {number}
   */
  getCumulativeFunding() {
    return this._events.reduce((a, e) => a + e.amount, 0);
  }

  /**
   * @returns {{timestamp:number, amount:number, rate:number}[]}
   */
  getHistory() {
    return this._events.slice();
  }
}

export default { computeFundingPayment, FundingCalculator };
