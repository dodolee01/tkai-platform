/**
 * @file In-memory, per-symbol market data cache. No database writes.
 * @module scanner/cache/CoinCache
 */

/**
 * @typedef {Object} CoinCacheEntry
 * @property {string} symbol
 * @property {number|null} price
 * @property {number|null} bid
 * @property {number|null} ask
 * @property {number|null} spread
 * @property {number|null} volume
 * @property {number|null} change24h
 * @property {number|null} funding
 * @property {number|null} markPrice
 * @property {number|null} indexPrice
 * @property {number|null} openInterest
 * @property {{longNotional:number, shortNotional:number, eventCount:number}} liquidationStats
 * @property {import('../orderbook/OrderBookEngine.js').OrderBookAnalytics|null} orderBook
 * @property {number|null} lastUpdate
 */

/**
 * Creates a fresh, empty cache entry for a symbol.
 * @param {string} symbol
 * @returns {CoinCacheEntry}
 */
function createEmptyEntry(symbol) {
  return {
    symbol,
    price: null,
    bid: null,
    ask: null,
    spread: null,
    volume: null,
    change24h: null,
    funding: null,
    markPrice: null,
    indexPrice: null,
    openInterest: null,
    liquidationStats: { longNotional: 0, shortNotional: 0, eventCount: 0 },
    orderBook: null,
    lastUpdate: null,
  };
}

/**
 * In-memory market data cache, one entry per symbol. Pure memory —
 * never touches PocketBase or any other persistence layer, by design
 * (this is a hot, high-frequency read/write path; every update here
 * is O(1) map access + shallow field assignment, no serialization).
 */
export class CoinCache {
  constructor() {
    /** @private @type {Map<string, CoinCacheEntry>} */
    this._entries = new Map();
  }

  /**
   * @param {string} symbol
   * @returns {CoinCacheEntry}
   * @private
   */
  _ensure(symbol) {
    let entry = this._entries.get(symbol);
    if (!entry) {
      entry = createEmptyEntry(symbol);
      this._entries.set(symbol, entry);
    }
    return entry;
  }

  /**
   * Merge a partial update into a symbol's entry. Only provided fields
   * are overwritten; `lastUpdate` is always bumped to now.
   * @param {string} symbol
   * @param {Partial<CoinCacheEntry>} patch
   * @returns {CoinCacheEntry} The updated entry.
   */
  update(symbol, patch) {
    const entry = this._ensure(symbol);
    Object.assign(entry, patch, { lastUpdate: Date.now() });
    return entry;
  }

  /**
   * Convenience updater for bookTicker-style best bid/ask events.
   * @param {string} symbol
   * @param {number} bid
   * @param {number} ask
   * @returns {CoinCacheEntry}
   */
  updateBookTicker(symbol, bid, ask) {
    return this.update(symbol, { bid, ask, spread: ask - bid });
  }

  /**
   * Convenience updater for a completed liquidation event, accumulating
   * into the symbol's running liquidation statistics.
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side - 'SELL' = long liquidated, 'BUY' = short liquidated.
   * @param {number} notional
   * @returns {CoinCacheEntry}
   */
  recordLiquidation(symbol, side, notional) {
    const entry = this._ensure(symbol);
    if (side === 'SELL') entry.liquidationStats.longNotional += notional;
    else entry.liquidationStats.shortNotional += notional;
    entry.liquidationStats.eventCount += 1;
    entry.lastUpdate = Date.now();
    return entry;
  }

  /**
   * @param {string} symbol
   * @returns {CoinCacheEntry|undefined}
   */
  get(symbol) {
    return this._entries.get(symbol);
  }

  /**
   * @returns {CoinCacheEntry[]} A snapshot array of all cached entries.
   */
  getAll() {
    return Array.from(this._entries.values());
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._entries.size;
  }

  /**
   * Remove entries that have not been updated within `maxAgeMs` — used
   * by the health monitor to bound memory if a symbol is delisted
   * mid-session and stops receiving stream data.
   * @param {number} maxAgeMs
   * @returns {number} Number of entries evicted.
   */
  evictStale(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    let evicted = 0;
    for (const [symbol, entry] of this._entries) {
      if (entry.lastUpdate !== null && entry.lastUpdate < cutoff) {
        this._entries.delete(symbol);
        evicted += 1;
      }
    }
    return evicted;
  }

  /**
   * Remove a single symbol's entry (e.g. on delisting).
   * @param {string} symbol
   * @returns {boolean}
   */
  delete(symbol) {
    return this._entries.delete(symbol);
  }

  /**
   * Clear the entire cache.
   * @returns {void}
   */
  clear() {
    this._entries.clear();
  }
}

export default CoinCache;
