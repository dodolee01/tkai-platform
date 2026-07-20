/**
 * @file Liquidation flow tracker — streaming implementation.
 * @module indicators/Liquidation
 */

/**
 * @typedef {Object} LiquidationEvent
 * @property {'BUY'|'SELL'} side - 'SELL' = a long was force-liquidated; 'BUY' = a short was force-liquidated.
 * @property {number} quantity
 * @property {number} price
 * @property {number} timestamp - Unix ms.
 */

/**
 * @typedef {Object} LiquidationValue
 * @property {number} longLiquidationNotional
 * @property {number} shortLiquidationNotional
 * @property {number} totalNotional
 * @property {number} eventCount
 * @property {'long_cascade'|'short_cascade'|'none'} cascadeDirection
 */

/**
 * Liquidation flow tracker.
 * Consumes forceOrder (liquidation) events (e.g. Binance's
 * `!forceOrder` stream) and aggregates them into a bounded
 * time-based rolling window to detect liquidation cascades.
 */
export class Liquidation {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowMs=300000] - Rolling window size in milliseconds (default 5 minutes).
   */
  constructor({ windowMs = 5 * 60 * 1000 } = {}) {
    /** @type {number} */ this.windowMs = windowMs;
    /** @private @type {(LiquidationEvent & {notional:number})[]} */ this._events = [];
    /** @private @type {LiquidationValue|null} */ this._value = null;
  }

  /**
   * Feed a single new liquidation event (streaming / incremental update).
   * @param {LiquidationEvent} event
   * @returns {LiquidationValue}
   */
  update(event) {
    const { side, quantity, price, timestamp } = event;
    if (side !== 'BUY' && side !== 'SELL') {
      throw new Error("Liquidation: side must be 'BUY' or 'SELL'");
    }
    if ([quantity, price, timestamp].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
      throw new Error('Liquidation: quantity/price/timestamp must be finite numbers');
    }

    this._events.push({ side, quantity, price, timestamp, notional: quantity * price });
    const cutoff = timestamp - this.windowMs;
    this._events = this._events.filter((e) => e.timestamp >= cutoff);

    const longLiqs = this._events.filter((e) => e.side === 'SELL');
    const shortLiqs = this._events.filter((e) => e.side === 'BUY');

    const longLiqNotional = longLiqs.reduce((a, e) => a + e.notional, 0);
    const shortLiqNotional = shortLiqs.reduce((a, e) => a + e.notional, 0);
    const totalNotional = longLiqNotional + shortLiqNotional;

    let cascadeDirection = 'none';
    if (totalNotional > 0) {
      const longRatio = longLiqNotional / totalNotional;
      if (longRatio > 0.7) cascadeDirection = 'long_cascade';
      else if (longRatio < 0.3) cascadeDirection = 'short_cascade';
    }

    this._value = {
      longLiquidationNotional: longLiqNotional,
      shortLiquidationNotional: shortLiqNotional,
      totalNotional,
      eventCount: this._events.length,
      cascadeDirection,
    };
    return this._value;
  }

  /**
   * @returns {LiquidationValue|null} The most recently computed value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._events = [];
    this._value = null;
  }
}

export default Liquidation;
