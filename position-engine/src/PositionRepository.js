/**
 * @file Position persistence contract. Per this module's
 * requirements, only the interface is defined here — no
 * database-specific implementation (PocketBase, PostgreSQL, etc.) is
 * bundled. An {@link InMemoryPositionRepository} is provided as the
 * default, dependency-free implementation so the engine is usable
 * out of the box and in tests; it is not a database and does not
 * violate the "interfaces only" requirement.
 *
 * A PocketBase or PostgreSQL-backed repository is a drop-in
 * implementation of this same contract (`save`, `getById`, `getAll`,
 * `getOpenPositions`, `update`, `delete`) supplied by the host
 * application — this module never imports a database client itself.
 * @module position-engine/PositionRepository
 */

/**
 * The storage contract every position repository implementation must
 * satisfy.
 * @interface PositionRepositoryContract
 */
/** @function @name PositionRepositoryContract#save @param {import('./types.js').Position} position @returns {Promise<import('./types.js').Position>} */
/** @function @name PositionRepositoryContract#getById @param {string} id @returns {Promise<import('./types.js').Position|null>} */
/** @function @name PositionRepositoryContract#getAll @returns {Promise<import('./types.js').Position[]>} */
/** @function @name PositionRepositoryContract#getOpenPositions @param {string} [userId] @returns {Promise<import('./types.js').Position[]>} */
/** @function @name PositionRepositoryContract#update @param {string} id @param {Partial<import('./types.js').Position>} patch @returns {Promise<import('./types.js').Position>} */
/** @function @name PositionRepositoryContract#delete @param {string} id @returns {Promise<boolean>} */

/**
 * Abstract base class defining the position repository contract.
 * @abstract
 */
export class PositionRepository {
  constructor() {
    if (new.target === PositionRepository) {
      throw new Error('PositionRepository is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @param {string} methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(methodName) {
    throw new Error(`${this.constructor.name} does not implement PositionRepository#${methodName}`);
  }

  /** @param {import('./types.js').Position} _position @returns {Promise<import('./types.js').Position>} */
  async save(_position) { this._notImplemented('save'); }

  /** @param {string} _id @returns {Promise<import('./types.js').Position|null>} */
  async getById(_id) { this._notImplemented('getById'); }

  /** @returns {Promise<import('./types.js').Position[]>} */
  async getAll() { this._notImplemented('getAll'); }

  /** @param {string} [_userId] @returns {Promise<import('./types.js').Position[]>} */
  async getOpenPositions(_userId) { this._notImplemented('getOpenPositions'); }

  /** @param {string} _id @param {Partial<import('./types.js').Position>} _patch @returns {Promise<import('./types.js').Position>} */
  async update(_id, _patch) { this._notImplemented('update'); }

  /** @param {string} _id @returns {Promise<boolean>} */
  async delete(_id) { this._notImplemented('delete'); }
}

const LIVE_STATES = new Set(['NEW', 'OPENING', 'OPEN', 'PARTIALLY_CLOSED', 'TRAILING', 'CLOSING']);

/**
 * In-memory implementation of {@link PositionRepository}. The default
 * used when no external repository is injected; also what the test
 * suite exercises against.
 * @extends PositionRepository
 */
export class InMemoryPositionRepository extends PositionRepository {
  constructor() {
    super();
    /** @private @type {Map<string, import('./types.js').Position>} */
    this._positions = new Map();
  }

  /** @param {import('./types.js').Position} position @returns {Promise<import('./types.js').Position>} */
  async save(position) {
    this._positions.set(position.id, { ...position });
    return this._positions.get(position.id);
  }

  /** @param {string} id @returns {Promise<import('./types.js').Position|null>} */
  async getById(id) {
    return this._positions.get(id) ?? null;
  }

  /** @returns {Promise<import('./types.js').Position[]>} */
  async getAll() {
    return Array.from(this._positions.values());
  }

  /** @param {string} [userId] @returns {Promise<import('./types.js').Position[]>} */
  async getOpenPositions(userId) {
    return Array.from(this._positions.values()).filter(
      (p) => LIVE_STATES.has(p.state) && (userId === undefined || p.userId === userId)
    );
  }

  /** @param {string} id @param {Partial<import('./types.js').Position>} patch @returns {Promise<import('./types.js').Position>} */
  async update(id, patch) {
    const existing = this._positions.get(id);
    if (!existing) {
      throw new Error(`InMemoryPositionRepository.update: no position with id "${id}"`);
    }
    const updated = { ...existing, ...patch };
    this._positions.set(id, updated);
    return updated;
  }

  /** @param {string} id @returns {Promise<boolean>} */
  async delete(id) {
    return this._positions.delete(id);
  }
}

export default { PositionRepository, InMemoryPositionRepository };
