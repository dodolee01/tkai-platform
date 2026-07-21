/**
 * @file Analytics persistence contract. Per this module's
 * requirements, only the interface is defined here — no
 * database-specific implementation (PocketBase, PostgreSQL, MongoDB,
 * etc.) is bundled. An {@link InMemoryAnalyticsRepository} is
 * provided as the default, dependency-free implementation. It
 * streams data in `config.repository.batchSize` pages via an
 * async generator, matching the "millions of historical trades"
 * performance requirement — callers never need to hold the entire
 * trade history in memory at once.
 * @module analytics-engine/AnalyticsRepository
 */

/**
 * The storage contract every analytics repository implementation must satisfy.
 * @interface AnalyticsRepositoryContract
 */
/** @function @name AnalyticsRepositoryContract#saveTrade @param {import('./types.js').TradeRecord} trade @returns {Promise<void>} */
/** @function @name AnalyticsRepositoryContract#getTrades @param {object} filter @returns {Promise<import('./types.js').TradeRecord[]>} */
/** @function @name AnalyticsRepositoryContract#streamTrades @param {object} filter @returns {AsyncGenerator<import('./types.js').TradeRecord[]>} */
/** @function @name AnalyticsRepositoryContract#saveReport @param {object} report @returns {Promise<object>} */
/** @function @name AnalyticsRepositoryContract#getReports @param {object} filter @returns {Promise<object[]>} */

/**
 * Abstract base class defining the analytics repository contract.
 * @abstract
 */
export class AnalyticsRepository {
  constructor() {
    if (new.target === AnalyticsRepository) {
      throw new Error('AnalyticsRepository is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @param {string} methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(methodName) {
    throw new Error(`${this.constructor.name} does not implement AnalyticsRepository#${methodName}`);
  }

  /** @param {import('./types.js').TradeRecord} _trade @returns {Promise<void>} */
  async saveTrade(_trade) { this._notImplemented('saveTrade'); }

  /** @param {object} [_filter] @returns {Promise<import('./types.js').TradeRecord[]>} */
  async getTrades(_filter) { this._notImplemented('getTrades'); }

  /** @param {object} [_filter] @returns {AsyncGenerator<import('./types.js').TradeRecord[]>} */
  async *streamTrades(_filter) { this._notImplemented('streamTrades'); }

  /** @param {object} _report @returns {Promise<object>} */
  async saveReport(_report) { this._notImplemented('saveReport'); }

  /** @param {object} [_filter] @returns {Promise<object[]>} */
  async getReports(_filter) { this._notImplemented('getReports'); }
}

/**
 * In-memory implementation of {@link AnalyticsRepository}. The
 * default used when no external repository is injected; also what
 * the test suite exercises against.
 * @extends AnalyticsRepository
 */
export class InMemoryAnalyticsRepository extends AnalyticsRepository {
  /**
   * @param {object} [config] - `config.repository` section.
   */
  constructor(config = { batchSize: 5000 }) {
    super();
    /** @private */ this._batchSize = config.batchSize;
    /** @private @type {import('./types.js').TradeRecord[]} */
    this._trades = [];
    /** @private @type {object[]} */
    this._reports = [];
  }

  /** @param {import('./types.js').TradeRecord} trade @returns {Promise<void>} */
  async saveTrade(trade) {
    this._trades.push({ ...trade });
  }

  /**
   * @param {object} [filter]
   * @param {string} [filter.userId]
   * @param {string} [filter.symbol]
   * @param {string} [filter.strategy]
   * @param {number} [filter.since]
   * @param {number} [filter.until]
   * @returns {Promise<import('./types.js').TradeRecord[]>}
   */
  async getTrades(filter = {}) {
    return this._applyFilter(this._trades, filter);
  }

  /**
   * Yields trades in fixed-size pages, so a caller processing
   * millions of records never holds them all in memory at once.
   * @param {object} [filter]
   * @returns {AsyncGenerator<import('./types.js').TradeRecord[]>}
   */
  async *streamTrades(filter = {}) {
    const matched = this._applyFilter(this._trades, filter);
    for (let i = 0; i < matched.length; i += this._batchSize) {
      yield matched.slice(i, i + this._batchSize);
    }
  }

  /**
   * @param {import('./types.js').TradeRecord[]} trades
   * @param {object} filter
   * @returns {import('./types.js').TradeRecord[]} Always a fresh array — never the live internal array — so callers can never accidentally alias and corrupt repository state.
   * @private
   */
  _applyFilter(trades, filter) {
    let result = trades.slice();
    if (filter.userId !== undefined) result = result.filter((t) => t.userId === filter.userId);
    if (filter.symbol !== undefined) result = result.filter((t) => t.symbol === filter.symbol);
    if (filter.strategy !== undefined) result = result.filter((t) => t.strategy === filter.strategy);
    if (filter.since !== undefined) result = result.filter((t) => t.closedAt >= filter.since);
    if (filter.until !== undefined) result = result.filter((t) => t.closedAt <= filter.until);
    return result;
  }

  /** @param {object} report @returns {Promise<object>} */
  async saveReport(report) {
    const stored = { ...report, id: report.id ?? `report_${this._reports.length + 1}` };
    this._reports.push(stored);
    return stored;
  }

  /**
   * @param {object} [filter]
   * @param {string} [filter.period]
   * @returns {Promise<object[]>}
   */
  async getReports(filter = {}) {
    let result = this._reports;
    if (filter.period !== undefined) result = result.filter((r) => r.period === filter.period);
    return result;
  }
}

export default { AnalyticsRepository, InMemoryAnalyticsRepository };
