/**
 * @file Persistence abstraction. Defines the storage contract every
 * adapter must satisfy, plus two concrete adapters: an in-memory one
 * (default, used in tests and for callers not yet wired to a
 * database) and a PocketBase one. A future PostgreSQL adapter only
 * needs to implement the same three methods — nothing else in this
 * module talks to storage directly.
 * @module learning-engine/Persistence
 */

/**
 * The storage contract every persistence adapter must implement.
 * @interface PersistenceAdapter
 */
/**
 * @function
 * @name PersistenceAdapter#save
 * @param {import('./types.js').CompletedTrade} trade
 * @returns {Promise<import('./types.js').CompletedTrade & {id:string}>}
 */
/**
 * @function
 * @name PersistenceAdapter#getAll
 * @returns {Promise<Array<import('./types.js').CompletedTrade & {id:string}>>}
 */
/**
 * @function
 * @name PersistenceAdapter#count
 * @returns {Promise<number>}
 */

/**
 * Default, dependency-free persistence adapter. Holds trades in an
 * in-process array. Suitable for tests and for any deployment that
 * hasn't wired a real database yet — swap in
 * {@link PocketBasePersistenceAdapter} (or a future PostgreSQL
 * adapter) without touching {@link import('./TradeStore.js').TradeStore}
 * or anything above it.
 * @implements {PersistenceAdapter}
 */
export class InMemoryPersistenceAdapter {
  constructor() {
    /** @private @type {Array<import('./types.js').CompletedTrade & {id:string}>} */
    this._trades = [];
    /** @private */
    this._nextId = 1;
  }

  /**
   * @param {import('./types.js').CompletedTrade} trade
   * @returns {Promise<import('./types.js').CompletedTrade & {id:string}>}
   */
  async save(trade) {
    const record = { ...trade, id: `mem_${this._nextId++}` };
    this._trades.push(record);
    return record;
  }

  /**
   * @returns {Promise<Array<import('./types.js').CompletedTrade & {id:string}>>}
   */
  async getAll() {
    return this._trades.slice();
  }

  /**
   * @returns {Promise<number>}
   */
  async count() {
    return this._trades.length;
  }
}

/**
 * PocketBase-backed persistence adapter. Trades are append-only: this
 * adapter deliberately exposes no update/delete method, matching the
 * "never modify historical trades" requirement.
 *
 * Expects a PocketBase JS SDK client instance (`new PocketBase(url)`)
 * injected via the constructor — this module never creates its own
 * network connection, so it stays fully unit-testable with a fake
 * client and works with whatever auth/connection lifecycle the host
 * application already manages.
 * @implements {PersistenceAdapter}
 */
export class PocketBasePersistenceAdapter {
  /**
   * @param {object} pbClient - A PocketBase SDK client instance (or a compatible fake for tests), exposing `.collection(name)`.
   * @param {string} [collectionName='learning_trades']
   */
  constructor(pbClient, collectionName = 'learning_trades') {
    if (!pbClient || typeof pbClient.collection !== 'function') {
      throw new Error('PocketBasePersistenceAdapter: pbClient with a .collection() method is required');
    }
    /** @private */ this._pb = pbClient;
    /** @private */ this._collectionName = collectionName;
  }

  /**
   * @param {import('./types.js').CompletedTrade} trade
   * @returns {Promise<import('./types.js').CompletedTrade & {id:string}>}
   */
  async save(trade) {
    // PocketBase stores nested objects as JSON fields directly; the
    // trade shape as defined in types.js maps onto a PocketBase
    // collection schema with matching field names one-to-one.
    const record = await this._pb.collection(this._collectionName).create(trade);
    return record;
  }

  /**
   * @returns {Promise<Array<import('./types.js').CompletedTrade & {id:string}>>}
   */
  async getAll() {
    return this._pb.collection(this._collectionName).getFullList({ sort: 'created' });
  }

  /**
   * @returns {Promise<number>}
   */
  async count() {
    const page = await this._pb.collection(this._collectionName).getList(1, 1);
    return page.totalItems;
  }
}

export default { InMemoryPersistenceAdapter, PocketBasePersistenceAdapter };
