/**
 * @file Open Interest poller.
 * Binance USDⓈ-M Futures does not expose a websocket stream for open
 * interest — it is REST-only (`GET /fapi/v1/openInterest`). This
 * component polls it on an interval per symbol, spread out to respect
 * REST rate limits, rather than pretending a websocket stream exists.
 * @module scanner/registry/OpenInterestPoller
 */

import { ScannerEvents } from '../core/EventBus.js';

/**
 * Polls Binance's `/fapi/v1/openInterest` endpoint for a rotating
 * subset of symbols each tick, so the full symbol universe is covered
 * over time without exceeding REST weight limits. The fetch function
 * is injected (Dependency Injection) so this class is fully
 * unit-testable without a real network connection.
 */
export class OpenInterestPoller {
  /**
   * @param {Object} deps
   * @param {(symbol: string) => Promise<{symbol:string, openInterest:string, time:number}>} deps.fetchOpenInterest
   * @param {import('../cache/CoinCache.js').CoinCache} deps.cache
   * @param {import('../core/EventBus.js').EventBus} [deps.eventBus]
   * @param {import('../core/Logger.js').Logger} [deps.logger]
   * @param {Object} [options]
   * @param {number} [options.tickIntervalMs=2000] - How often to poll a batch of symbols.
   * @param {number} [options.symbolsPerTick=10] - How many symbols to poll per tick.
   */
  constructor(
    { fetchOpenInterest, cache, eventBus, logger },
    { tickIntervalMs = 2000, symbolsPerTick = 10 } = {}
  ) {
    if (typeof fetchOpenInterest !== 'function') {
      throw new Error('OpenInterestPoller: fetchOpenInterest dependency is required');
    }
    /** @private */ this._fetchOpenInterest = fetchOpenInterest;
    /** @private */ this._cache = cache;
    /** @private */ this._eventBus = eventBus;
    /** @private */ this._logger = logger;
    /** @type {number} */ this.tickIntervalMs = tickIntervalMs;
    /** @type {number} */ this.symbolsPerTick = symbolsPerTick;

    /** @private @type {string[]} */ this._symbols = [];
    /** @private */ this._cursor = 0;
    /** @private */ this._timer = null;
  }

  /**
   * Replace the set of symbols to poll (call whenever the symbol
   * registry refreshes).
   * @param {string[]} symbols
   * @returns {void}
   */
  setSymbols(symbols) {
    this._symbols = symbols.slice();
    if (this._cursor >= this._symbols.length) this._cursor = 0;
  }

  /**
   * Poll the next batch of `symbolsPerTick` symbols (wrapping around
   * the symbol list), updating the cache and emitting `oi:update` for each.
   * @returns {Promise<void>}
   */
  async pollNextBatch() {
    if (this._symbols.length === 0) return;

    const batch = [];
    for (let i = 0; i < Math.min(this.symbolsPerTick, this._symbols.length); i++) {
      batch.push(this._symbols[this._cursor]);
      this._cursor = (this._cursor + 1) % this._symbols.length;
    }

    await Promise.all(
      batch.map(async (symbol) => {
        try {
          const result = await this._fetchOpenInterest(symbol);
          const openInterest = Number(result.openInterest);
          this._cache?.update(symbol, { openInterest });
          this._eventBus?.safeEmit(ScannerEvents.OI_UPDATE, { symbol, openInterest, time: result.time });
        } catch (err) {
          this._logger?.warn('Open interest poll failed', { symbol, error: err.message });
        }
      })
    );
  }

  /**
   * Start polling on the configured interval.
   * @returns {void}
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.pollNextBatch().catch((err) => this._logger?.error('OI poll batch failed', { error: err.message }));
    }, this.tickIntervalMs);
    this._timer.unref?.();
  }

  /**
   * Stop polling.
   * @returns {void}
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

export default OpenInterestPoller;
