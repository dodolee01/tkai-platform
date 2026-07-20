/**
 * @file Order Book analyzer — streaming implementation.
 * @module indicators/OrderBook
 */

/**
 * @typedef {Object} OrderBookSnapshot
 * @property {[number, number][]} bids - [price, quantity] pairs, sorted descending by price.
 * @property {[number, number][]} asks - [price, quantity] pairs, sorted ascending by price.
 */

/**
 * @typedef {Object} OrderBookWall
 * @property {number} price
 * @property {number} quantity
 */

/**
 * @typedef {Object} OrderBookValue
 * @property {number} bidVolume
 * @property {number} askVolume
 * @property {number} imbalance - Range [-1, 1]; positive means bid-heavy.
 * @property {number|null} spread
 * @property {number|null} midPrice
 * @property {OrderBookWall[]} bidWalls
 * @property {OrderBookWall[]} askWalls
 */

/**
 * Order Book analyzer.
 * Consumes L2 depth snapshots (e.g. maintained externally from a
 * Binance `@depth` diff stream) and derives imbalance and wall
 * metrics from the top N levels. Each {@link OrderBook#update} call
 * is O(depthLevels), not O(full book size).
 */
export class OrderBook {
  /**
   * @param {Object} [options]
   * @param {number} [options.depthLevels=20] - Number of top levels to analyze per side.
   */
  constructor({ depthLevels = 20 } = {}) {
    /** @type {number} */
    this.depthLevels = depthLevels;
    /** @private @type {OrderBookValue|null} */
    this._value = null;
  }

  /**
   * Feed a single new order book snapshot (streaming / incremental update).
   * @param {OrderBookSnapshot} book
   * @returns {OrderBookValue}
   */
  update(book) {
    const { bids, asks } = book;
    if (!Array.isArray(bids) || !Array.isArray(asks)) {
      throw new Error('OrderBook: bids and asks must be arrays of [price, quantity]');
    }

    const topBids = bids.slice(0, this.depthLevels);
    const topAsks = asks.slice(0, this.depthLevels);

    const bidVolume = topBids.reduce((a, [, qty]) => a + qty, 0);
    const askVolume = topAsks.reduce((a, [, qty]) => a + qty, 0);
    const totalVolume = bidVolume + askVolume;

    const imbalance = totalVolume === 0 ? 0 : (bidVolume - askVolume) / totalVolume;

    const bestBid = topBids.length ? topBids[0][0] : null;
    const bestAsk = topAsks.length ? topAsks[0][0] : null;
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
    const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;

    const wallThreshold = 5;

    /**
     * A "wall" is a level whose size exceeds `wallThreshold`x the average
     * size of every *other* level on the same side — computed excluding
     * the candidate itself so a single dominant level isn't diluted out
     * of its own comparison baseline.
     * @param {[number, number][]} levels
     * @returns {OrderBookWall[]}
     */
    const detectWalls = (levels) =>
      levels
        .map(([price, qty], idx) => {
          const others = levels.filter((_, i) => i !== idx);
          const othersAvg = others.length
            ? others.reduce((a, [, q]) => a + q, 0) / others.length
            : 0;
          return { price, quantity: qty, othersAvg };
        })
        .filter((w) => w.othersAvg > 0 && w.quantity > w.othersAvg * wallThreshold)
        .map(({ price, quantity }) => ({ price, quantity }));

    const bidWalls = detectWalls(topBids);
    const askWalls = detectWalls(topAsks);

    this._value = { bidVolume, askVolume, imbalance, spread, midPrice, bidWalls, askWalls };
    return this._value;
  }

  /**
   * @returns {OrderBookValue|null} The most recently computed value.
   */
  get value() {
    return this._value;
  }

  /**
   * Clear all internal state.
   * @returns {void}
   */
  reset() {
    this._value = null;
  }
}

export default OrderBook;
