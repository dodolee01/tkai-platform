/**
 * @file Binance USDT-M Futures symbol registry.
 * @module scanner/registry/SymbolRegistry
 */

/**
 * @typedef {Object} SymbolInfo
 * @property {string} symbol
 * @property {string} baseAsset
 * @property {string} quoteAsset
 * @property {string} status
 * @property {number} tickSize
 * @property {number} stepSize
 * @property {number} minQty
 * @property {number} maxQty
 * @property {number} pricePrecision
 * @property {number} quantityPrecision
 * @property {{minLeverage:number, maxLeverage:number, brackets:Array<Object>}|null} leverage
 */

/**
 * Parse a single raw `exchangeInfo` symbol entry into a normalized
 * {@link SymbolInfo}. Exported standalone so it can be unit tested
 * against fixture JSON without any network access.
 * @param {object} rawSymbol - One entry from Binance `/fapi/v1/exchangeInfo` `symbols[]`.
 * @returns {SymbolInfo}
 */
export function parseSymbolInfo(rawSymbol) {
  const priceFilter = rawSymbol.filters.find((f) => f.filterType === 'PRICE_FILTER');
  const lotSizeFilter = rawSymbol.filters.find((f) => f.filterType === 'LOT_SIZE');
  const marketLotSizeFilter = rawSymbol.filters.find((f) => f.filterType === 'MARKET_LOT_SIZE');

  return {
    symbol: rawSymbol.symbol,
    baseAsset: rawSymbol.baseAsset,
    quoteAsset: rawSymbol.quoteAsset,
    status: rawSymbol.status,
    tickSize: priceFilter ? Number(priceFilter.tickSize) : null,
    stepSize: lotSizeFilter ? Number(lotSizeFilter.stepSize) : null,
    minQty: lotSizeFilter ? Number(lotSizeFilter.minQty) : null,
    maxQty: lotSizeFilter ? Number(lotSizeFilter.maxQty) : null,
    marketMinQty: marketLotSizeFilter ? Number(marketLotSizeFilter.minQty) : null,
    marketMaxQty: marketLotSizeFilter ? Number(marketLotSizeFilter.maxQty) : null,
    pricePrecision: rawSymbol.pricePrecision,
    quantityPrecision: rawSymbol.quantityPrecision,
    contractType: rawSymbol.contractType,
    // Binance's exchangeInfo does not include per-symbol leverage brackets;
    // those come from the authenticated /fapi/v1/leverageBracket endpoint.
    // Left null here and populated by attachLeverageBrackets() when a
    // signed client is available (see fetchLeverageBrackets injection point).
    leverage: null,
  };
}

/**
 * In-memory registry of tradable Binance USDT-M perpetual futures
 * symbols, refreshed on a timer. Network access is injected via
 * `fetchExchangeInfo` so this class is fully unit-testable offline.
 */
export class SymbolRegistry {
  /**
   * @param {Object} deps
   * @param {() => Promise<object>} deps.fetchExchangeInfo - Returns the raw `/fapi/v1/exchangeInfo` JSON body.
   * @param {import('../core/Logger.js').Logger} deps.logger
   * @param {import('../core/EventBus.js').EventBus} deps.eventBus
   * @param {Object} [options]
   * @param {number} [options.refreshIntervalMs=3600000] - Auto-refresh interval (default 1 hour).
   */
  constructor({ fetchExchangeInfo, logger, eventBus }, { refreshIntervalMs = 60 * 60 * 1000 } = {}) {
    if (typeof fetchExchangeInfo !== 'function') {
      throw new Error('SymbolRegistry: fetchExchangeInfo dependency is required');
    }
    /** @private */ this._fetchExchangeInfo = fetchExchangeInfo;
    /** @private */ this._logger = logger;
    /** @private */ this._eventBus = eventBus;
    /** @type {number} */ this.refreshIntervalMs = refreshIntervalMs;

    /** @private @type {Map<string, SymbolInfo>} */
    this._symbols = new Map();
    /** @private @type {ReturnType<typeof setInterval>|null} */
    this._refreshTimer = null;
    /** @private */
    this._lastRefreshedAt = null;
  }

  /**
   * Fetch, parse, and store the full symbol list. Only PERPETUAL
   * contracts quoted in USDT with TRADING status are retained.
   * @returns {Promise<SymbolInfo[]>}
   */
  async refresh() {
    const raw = await this._fetchExchangeInfo();
    if (!raw || !Array.isArray(raw.symbols)) {
      throw new Error('SymbolRegistry: exchangeInfo response missing symbols[] array');
    }

    const parsed = raw.symbols
      .filter(
        (s) =>
          s.contractType === 'PERPETUAL' &&
          s.quoteAsset === 'USDT' &&
          s.status === 'TRADING'
      )
      .map(parseSymbolInfo);

    this._symbols = new Map(parsed.map((s) => [s.symbol, s]));
    this._lastRefreshedAt = Date.now();

    this._logger?.info('Symbol registry refreshed', { count: this._symbols.size });
    this._eventBus?.safeEmit('registry:refreshed', {
      count: this._symbols.size,
      timestamp: this._lastRefreshedAt,
    });

    return parsed;
  }

  /**
   * Start the automatic hourly (configurable) refresh cycle. Performs
   * an immediate refresh first, then schedules subsequent refreshes.
   * @returns {Promise<void>}
   */
  async start() {
    await this._safeRefresh();
    this._refreshTimer = setInterval(() => this._safeRefresh(), this.refreshIntervalMs);
    this._refreshTimer.unref?.();
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async _safeRefresh() {
    try {
      await this.refresh();
    } catch (err) {
      this._logger?.error('Symbol registry refresh failed', { error: err.message });
      this._eventBus?.safeEmit('registry:error', { error: err.message, timestamp: Date.now() });
    }
  }

  /**
   * Stop the automatic refresh cycle.
   * @returns {void}
   */
  stop() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /**
   * @param {string} symbol
   * @returns {SymbolInfo|undefined}
   */
  get(symbol) {
    return this._symbols.get(symbol);
  }

  /**
   * @returns {SymbolInfo[]} All currently tradable symbols.
   */
  getAll() {
    return Array.from(this._symbols.values());
  }

  /**
   * @returns {string[]} All currently tradable symbol names.
   */
  getSymbolNames() {
    return Array.from(this._symbols.keys());
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._symbols.size;
  }

  /**
   * @returns {number|null} Unix ms timestamp of the last successful refresh.
   */
  get lastRefreshedAt() {
    return this._lastRefreshedAt;
  }
}

export default SymbolRegistry;
