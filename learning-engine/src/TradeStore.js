/**
 * @file Append-only store for completed trades. Historical trades are
 * never modified or deleted — only inserted and read.
 * @module learning-engine/TradeStore
 */

import { InMemoryPersistenceAdapter } from './Persistence.js';

/**
 * Owns the full trade history: persists every completed trade via an
 * injected {@link import('./Persistence.js').PersistenceAdapter} and
 * keeps an in-memory cache for synchronous, fast statistics reads
 * (recomputing every stat from a database round-trip on every
 * `recordTrade` would not scale).
 */
export class TradeStore {
  /**
   * @param {Object} [deps]
   * @param {import('./Persistence.js').PersistenceAdapter} [deps.persistenceAdapter] - Defaults to an in-memory adapter.
   * @param {import('./Config.js').Logger} [deps.logger]
   */
  constructor({ persistenceAdapter = new InMemoryPersistenceAdapter(), logger = null } = {}) {
    /** @private */ this._persistence = persistenceAdapter;
    /** @private */ this._logger = logger;
    /** @private @type {Array<import('./types.js').CompletedTrade & {id?:string}>} */
    this._cache = [];
    /** @private */ this._hydrated = false;
  }

  /**
   * Load existing trade history from the persistence layer into the
   * in-memory cache. Call once at startup, before relying on
   * {@link TradeStore#getAllTrades} to reflect prior sessions.
   * @returns {Promise<void>}
   */
  async hydrate() {
    const existing = await this._persistence.getAll();
    this._cache = existing.slice();
    this._hydrated = true;
    this._logger?.info?.(`TradeStore hydrated with ${existing.length} historical trades`);
  }

  /**
   * Persist a newly completed trade and add it to the in-memory cache.
   * @param {import('./types.js').CompletedTrade} trade
   * @returns {Promise<import('./types.js').CompletedTrade & {id?:string}>}
   */
  async recordTrade(trade) {
    this._validateTrade(trade);
    const stored = await this._persistence.save({ ...trade, timestamp: trade.timestamp ?? Date.now() });
    this._cache.push(stored);
    return stored;
  }

  /**
   * @param {import('./types.js').CompletedTrade} trade
   * @returns {void}
   * @private
   */
  _validateTrade(trade) {
    const requiredFields = ['symbol', 'side', 'entryPrice', 'exitPrice', 'pnl', 'pnlPercent', 'decision'];
    const missing = requiredFields.filter((f) => trade[f] === undefined || trade[f] === null);
    if (missing.length > 0) {
      throw new Error(`TradeStore.recordTrade: missing required field(s): ${missing.join(', ')}`);
    }
  }

  /**
   * @returns {Array<import('./types.js').CompletedTrade & {id?:string}>} A snapshot array of every recorded trade, oldest first.
   */
  getAllTrades() {
    return this._cache.slice();
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._cache.length;
  }

  /**
   * @returns {boolean} Whether {@link TradeStore#hydrate} has completed at least once.
   */
  get isHydrated() {
    return this._hydrated;
  }
}

export default TradeStore;
