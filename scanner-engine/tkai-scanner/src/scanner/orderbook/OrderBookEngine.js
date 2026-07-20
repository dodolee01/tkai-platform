/**
 * @file Per-symbol Level-20 order book engine with microstructure analytics.
 * @module scanner/orderbook/OrderBookEngine
 */

/**
 * @typedef {Object} BookLevel
 * @property {number} price
 * @property {number} quantity
 */

/**
 * @typedef {Object} DepthDiff
 * @property {[string, string][]} b - Bid updates: [price, quantity] as strings (Binance format). quantity "0" means remove.
 * @property {[string, string][]} a - Ask updates: [price, quantity] as strings.
 * @property {number} [u] - Final update ID of this event (for gap detection).
 * @property {number} [U] - First update ID of this event.
 */

/**
 * @typedef {Object} OrderBookAnalytics
 * @property {number} bidPressure - Total bid volume across retained levels.
 * @property {number} askPressure - Total ask volume across retained levels.
 * @property {number} imbalance - (bidPressure - askPressure) / (bidPressure + askPressure), in [-1, 1].
 * @property {number} delta - bidPressure - askPressure (absolute unit, not normalized).
 * @property {BookLevel[]} bidWalls
 * @property {BookLevel[]} askWalls
 * @property {number|null} spread
 * @property {number|null} midPrice
 * @property {{possible:boolean, side:'bid'|'ask'|null}} spoofSignal
 * @property {{absorbing:boolean, side:'bid'|'ask'|null}} absorption
 */

/**
 * Maintains a single symbol's Level-20 order book from a snapshot +
 * diff stream (the standard Binance depth-update pattern), and
 * derives pressure, imbalance, wall, spoof-detection-helper, and
 * absorption analytics. All updates are O(depth) — never a full
 * order book rescan beyond the retained levels.
 */
export class OrderBookEngine {
  /**
   * @param {string} symbol
   * @param {Object} [options]
   * @param {number} [options.depthLevels=20]
   * @param {number} [options.wallMultiplier=5] - A level > wallMultiplier x the average of other levels is a "wall".
   * @param {number} [options.spoofCancelWindowMs=2000] - Window in which a large level appearing then vanishing is flagged as a possible spoof.
   */
  constructor(symbol, { depthLevels = 20, wallMultiplier = 5, spoofCancelWindowMs = 2000 } = {}) {
    /** @type {string} */
    this.symbol = symbol;
    /** @type {number} */
    this.depthLevels = depthLevels;
    /** @type {number} */
    this.wallMultiplier = wallMultiplier;
    /** @type {number} */
    this.spoofCancelWindowMs = spoofCancelWindowMs;

    /** @private @type {Map<number, number>} price -> quantity */
    this._bids = new Map();
    /** @private @type {Map<number, number>} price -> quantity */
    this._asks = new Map();
    /** @private */ this._lastUpdateId = null;
    /** @private */ this._prevBidPressure = null;
    /** @private */ this._prevAskPressure = null;
    /** @private @type {{price:number, side:'bid'|'ask', quantity:number, seenAt:number}[]} */
    this._recentLargeLevels = [];
    /** @private @type {OrderBookAnalytics|null} */
    this._value = null;
  }

  /**
   * Apply a full REST snapshot (`/fapi/v1/depth`), replacing all local state.
   * Call this once before applying the diff stream, per Binance's
   * documented snapshot+diff synchronization procedure.
   * @param {{lastUpdateId:number, bids:[string,string][], asks:[string,string][]}} snapshot
   * @returns {void}
   */
  applySnapshot(snapshot) {
    this._bids.clear();
    this._asks.clear();
    for (const [price, qty] of snapshot.bids) {
      const q = Number(qty);
      if (q > 0) this._bids.set(Number(price), q);
    }
    for (const [price, qty] of snapshot.asks) {
      const q = Number(qty);
      if (q > 0) this._asks.set(Number(price), q);
    }
    this._lastUpdateId = snapshot.lastUpdateId;
    this._recompute();
  }

  /**
   * Apply a single diff-depth event. A quantity of "0" removes the level.
   * @param {DepthDiff} diff
   * @returns {OrderBookAnalytics}
   */
  applyDiff(diff) {
    for (const [priceStr, qtyStr] of diff.b || []) {
      this._applyLevel(this._bids, priceStr, qtyStr, 'bid');
    }
    for (const [priceStr, qtyStr] of diff.a || []) {
      this._applyLevel(this._asks, priceStr, qtyStr, 'ask');
    }
    if (typeof diff.u === 'number') this._lastUpdateId = diff.u;

    return this._recompute();
  }

  /**
   * @param {Map<number, number>} side
   * @param {string} priceStr
   * @param {string} qtyStr
   * @param {'bid'|'ask'} sideLabel
   * @returns {void}
   * @private
   */
  _applyLevel(side, priceStr, qtyStr, sideLabel) {
    const price = Number(priceStr);
    const qty = Number(qtyStr);
    if (qty === 0) {
      side.delete(price);
      return;
    }

    // Compute the average of every OTHER existing level (excluding this
    // one) *before* inserting/updating it, so a large incoming level
    // doesn't dilute its own comparison baseline.
    let othersSum = 0;
    let othersCount = 0;
    for (const [p, q] of side) {
      if (p === price) continue;
      othersSum += q;
      othersCount += 1;
    }
    side.set(price, qty);

    const othersAvg = othersCount > 0 ? othersSum / othersCount : 0;
    if (othersAvg > 0 && qty > othersAvg * this.wallMultiplier) {
      this._recentLargeLevels.push({ price, side: sideLabel, quantity: qty, seenAt: Date.now() });
      if (this._recentLargeLevels.length > 50) this._recentLargeLevels.shift();
    }
  }

  /**
   * Recompute derived analytics from current top-N levels. O(depthLevels log depthLevels)
   * due to sorting the (already small) retained level set.
   * @returns {OrderBookAnalytics}
   * @private
   */
  _recompute() {
    const topBids = Array.from(this._bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, this.depthLevels)
      .map(([price, quantity]) => ({ price, quantity }));
    const topAsks = Array.from(this._asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, this.depthLevels)
      .map(([price, quantity]) => ({ price, quantity }));

    const bidPressure = topBids.reduce((a, l) => a + l.quantity, 0);
    const askPressure = topAsks.reduce((a, l) => a + l.quantity, 0);
    const total = bidPressure + askPressure;
    const imbalance = total === 0 ? 0 : (bidPressure - askPressure) / total;
    const delta = bidPressure - askPressure;

    const bidWalls = this._detectWalls(topBids);
    const askWalls = this._detectWalls(topAsks);

    const bestBid = topBids[0]?.price ?? null;
    const bestAsk = topAsks[0]?.price ?? null;
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;

    const spoofSignal = this._detectSpoof();
    const absorption = this._detectAbsorption(bidPressure, askPressure);

    this._prevBidPressure = bidPressure;
    this._prevAskPressure = askPressure;

    this._value = {
      bidPressure,
      askPressure,
      imbalance,
      delta,
      bidWalls,
      askWalls,
      spread,
      midPrice,
      spoofSignal,
      absorption,
    };
    return this._value;
  }

  /**
   * @param {BookLevel[]} levels
   * @returns {BookLevel[]}
   * @private
   */
  _detectWalls(levels) {
    return levels
      .map((level, idx) => {
        const others = levels.filter((_, i) => i !== idx);
        const othersAvg = others.length
          ? others.reduce((a, l) => a + l.quantity, 0) / others.length
          : 0;
        return { ...level, othersAvg };
      })
      .filter((l) => l.othersAvg > 0 && l.quantity > l.othersAvg * this.wallMultiplier)
      .map(({ price, quantity }) => ({ price, quantity }));
  }

  /**
   * Spoofing helper: flags when a previously-observed unusually large
   * level has vanished from the book within `spoofCancelWindowMs` of
   * first appearing. This is a *helper signal* for a human/AI layer
   * to weigh, not a definitive spoof determination.
   * @returns {{possible:boolean, side:'bid'|'ask'|null}}
   * @private
   */
  _detectSpoof() {
    const now = Date.now();
    for (let i = this._recentLargeLevels.length - 1; i >= 0; i--) {
      const entry = this._recentLargeLevels[i];
      const age = now - entry.seenAt;
      if (age > this.spoofCancelWindowMs) {
        this._recentLargeLevels.splice(i, 1);
        continue;
      }
      const bookSide = entry.side === 'bid' ? this._bids : this._asks;
      const stillPresent = bookSide.has(entry.price) && bookSide.get(entry.price) >= entry.quantity * 0.5;
      if (!stillPresent) {
        this._recentLargeLevels.splice(i, 1);
        return { possible: true, side: entry.side };
      }
    }
    return { possible: false, side: null };
  }

  /**
   * Absorption helper: flags when pressure on one side is dropping
   * sharply while price has not moved proportionally — i.e. resting
   * size is being consumed ("absorbed") without yielding the level.
   * @param {number} bidPressure
   * @param {number} askPressure
   * @returns {{absorbing:boolean, side:'bid'|'ask'|null}}
   * @private
   */
  _detectAbsorption(bidPressure, askPressure) {
    if (this._prevBidPressure === null || this._prevAskPressure === null) {
      return { absorbing: false, side: null };
    }
    const bidDropRatio = this._prevBidPressure === 0 ? 0 : (this._prevBidPressure - bidPressure) / this._prevBidPressure;
    const askDropRatio = this._prevAskPressure === 0 ? 0 : (this._prevAskPressure - askPressure) / this._prevAskPressure;

    const ABSORPTION_THRESHOLD = 0.3; // 30%+ single-update drop in resting size
    if (bidDropRatio > ABSORPTION_THRESHOLD && bidDropRatio > askDropRatio) {
      return { absorbing: true, side: 'bid' };
    }
    if (askDropRatio > ABSORPTION_THRESHOLD && askDropRatio > bidDropRatio) {
      return { absorbing: true, side: 'ask' };
    }
    return { absorbing: false, side: null };
  }

  /**
   * @returns {OrderBookAnalytics|null}
   */
  get value() {
    return this._value;
  }

  /**
   * @returns {number|null} The last applied Binance update ID (for gap/sequence validation).
   */
  get lastUpdateId() {
    return this._lastUpdateId;
  }

  /**
   * Clear all state.
   * @returns {void}
   */
  reset() {
    this._bids.clear();
    this._asks.clear();
    this._lastUpdateId = null;
    this._prevBidPressure = null;
    this._prevAskPressure = null;
    this._recentLargeLevels = [];
    this._value = null;
  }
}

export default OrderBookEngine;
