/**
 * @file Portfolio persistence contract. Per this module's
 * requirements, only the interface is defined here — no
 * database-specific implementation (PocketBase, PostgreSQL, etc.) is
 * bundled. An {@link InMemoryPortfolioRepository} is provided as the
 * default, dependency-free implementation so the engine is usable
 * out of the box and in tests; it is not a database and does not
 * violate the "interfaces only" requirement.
 * @module portfolio-engine/PortfolioRepository
 */

/**
 * The storage contract every portfolio repository implementation
 * must satisfy, covering both balances and snapshots.
 * @interface PortfolioRepositoryContract
 */
/** @function @name PortfolioRepositoryContract#saveBalance @param {import('./types.js').AssetBalance} balance @returns {Promise<void>} */
/** @function @name PortfolioRepositoryContract#getBalances @param {string} [userId] @returns {Promise<import('./types.js').AssetBalance[]>} */
/** @function @name PortfolioRepositoryContract#saveSnapshot @param {import('./types.js').PortfolioSnapshotRecord} snapshot @returns {Promise<import('./types.js').PortfolioSnapshotRecord>} */
/** @function @name PortfolioRepositoryContract#getSnapshots @param {string} [granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord[]>} */
/** @function @name PortfolioRepositoryContract#getLatestSnapshot @param {string} [granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord|null>} */

/**
 * Abstract base class defining the portfolio repository contract.
 * @abstract
 */
export class PortfolioRepository {
  constructor() {
    if (new.target === PortfolioRepository) {
      throw new Error('PortfolioRepository is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @param {string} methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(methodName) {
    throw new Error(`${this.constructor.name} does not implement PortfolioRepository#${methodName}`);
  }

  /** @param {import('./types.js').AssetBalance} _balance @returns {Promise<void>} */
  async saveBalance(_balance) { this._notImplemented('saveBalance'); }

  /** @param {string} [_userId] @returns {Promise<import('./types.js').AssetBalance[]>} */
  async getBalances(_userId) { this._notImplemented('getBalances'); }

  /** @param {import('./types.js').PortfolioSnapshotRecord} _snapshot @returns {Promise<import('./types.js').PortfolioSnapshotRecord>} */
  async saveSnapshot(_snapshot) { this._notImplemented('saveSnapshot'); }

  /** @param {string} [_granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord[]>} */
  async getSnapshots(_granularity) { this._notImplemented('getSnapshots'); }

  /** @param {string} [_granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord|null>} */
  async getLatestSnapshot(_granularity) { this._notImplemented('getLatestSnapshot'); }
}

/**
 * In-memory implementation of {@link PortfolioRepository}. The
 * default used when no external repository is injected; also what
 * the test suite exercises against.
 * @extends PortfolioRepository
 */
export class InMemoryPortfolioRepository extends PortfolioRepository {
  constructor() {
    super();
    /** @private @type {Map<string, import('./types.js').AssetBalance>} */
    this._balances = new Map();
    /** @private @type {import('./types.js').PortfolioSnapshotRecord[]} */
    this._snapshots = [];
  }

  /** @param {import('./types.js').AssetBalance} balance @returns {Promise<void>} */
  async saveBalance(balance) {
    this._balances.set(`${balance.userId}::${balance.exchange}::${balance.asset}`, { ...balance });
  }

  /** @param {string} [userId] @returns {Promise<import('./types.js').AssetBalance[]>} */
  async getBalances(userId) {
    const all = Array.from(this._balances.values());
    return userId === undefined ? all : all.filter((b) => b.userId === userId);
  }

  /** @param {import('./types.js').PortfolioSnapshotRecord} snapshot @returns {Promise<import('./types.js').PortfolioSnapshotRecord>} */
  async saveSnapshot(snapshot) {
    const frozen = Object.freeze({ ...snapshot });
    this._snapshots.push(frozen);
    return frozen;
  }

  /** @param {string} [granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord[]>} */
  async getSnapshots(granularity) {
    return granularity === undefined ? this._snapshots.slice() : this._snapshots.filter((s) => s.granularity === granularity);
  }

  /** @param {string} [granularity] @returns {Promise<import('./types.js').PortfolioSnapshotRecord|null>} */
  async getLatestSnapshot(granularity) {
    const matches = await this.getSnapshots(granularity);
    if (matches.length === 0) return null;
    return matches.reduce((latest, s) => (s.timestamp > latest.timestamp ? s : latest));
  }
}

export default { PortfolioRepository, InMemoryPortfolioRepository };
