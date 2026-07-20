/**
 * @file Top-level orchestrator — wires together configuration, the
 * symbol registry, the open-interest poller, the worker pool, and
 * health/metrics monitoring into a single, startable/stoppable
 * scanner instance. This is the module's public entrypoint.
 * @module scanner/ScannerManager
 */

import { loadConfig } from './config/index.js';
import { Logger } from './core/Logger.js';
import { EventBus } from './core/EventBus.js';
import { Metrics } from './core/Metrics.js';
import { HealthMonitor } from './core/HealthMonitor.js';
import { SymbolRegistry } from './registry/SymbolRegistry.js';
import { OpenInterestPoller } from './registry/OpenInterestPoller.js';
import { WorkerPoolManager } from './workers/WorkerPoolManager.js';
import { CoinCache } from './cache/CoinCache.js';

/**
 * Default REST fetcher for `/fapi/v1/exchangeInfo`, using Node 22's
 * built-in global `fetch`. Injectable so tests never hit the network.
 * @param {string} restBaseUrl
 * @param {string} path
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
async function defaultFetchJson(restBaseUrl, path, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${restBaseUrl}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Binance REST request failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The Binance Institutional Scanner. Owns the full market-data layer
 * lifecycle: symbol discovery, worker-distributed websocket streaming,
 * open-interest polling, and health/metrics monitoring.
 *
 * Deliberately does NOT contain any AI decision-making, risk
 * management, or trade-execution logic — those are separate modules
 * that consume this scanner's {@link EventBus} events.
 */
export class ScannerManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.env] - Environment profile name; see config/index.js.
   * @param {(restBaseUrl:string, path:string, timeoutMs:number) => Promise<object>} [options.fetchJson] - Injectable REST fetcher (DI for tests).
   */
  constructor({ env, fetchJson = defaultFetchJson } = {}) {
    /** @type {object} */
    this.config = loadConfig(env);
    /** @private */
    this._fetchJson = fetchJson;

    /** @type {Logger} */
    this.logger = new Logger({
      level: this.config.logging.level,
      dir: this.config.logging.dir,
      filename: 'scanner-master.log',
      namespace: 'scanner:master',
      maxFileSizeBytes: this.config.logging.maxFileSizeBytes,
      maxFiles: this.config.logging.maxFiles,
    });

    /** @type {EventBus} */
    this.eventBus = new EventBus();

    /** @type {Metrics} */
    this.metrics = new Metrics({ sampleIntervalMs: this.config.metrics.sampleIntervalMs });

    /** @type {HealthMonitor} */
    this.healthMonitor = new HealthMonitor(
      { metrics: this.metrics, eventBus: this.eventBus, logger: this.logger },
      this.config.health
    );

    /** @type {SymbolRegistry} */
    this.symbolRegistry = new SymbolRegistry(
      {
        fetchExchangeInfo: () =>
          this._fetchJson(this.config.binance.restBaseUrl, this.config.binance.exchangeInfoPath, this.config.registry.requestTimeoutMs),
        logger: this.logger.child('registry'),
        eventBus: this.eventBus,
      },
      { refreshIntervalMs: this.config.registry.refreshIntervalMs }
    );

    /**
     * Open Interest is polled on the master thread (REST-only, no
     * per-worker websocket stream exists for it — see OpenInterestPoller
     * docs) and cached here; {@link getMarketSnapshot} merges it into
     * each worker's per-symbol data by symbol name.
     * @type {CoinCache}
     */
    this.masterCache = new CoinCache();

    /** @type {OpenInterestPoller} */
    this.openInterestPoller = new OpenInterestPoller(
      {
        fetchOpenInterest: (symbol) =>
          this._fetchJson(this.config.binance.restBaseUrl, `/fapi/v1/openInterest?symbol=${symbol}`, this.config.registry.requestTimeoutMs),
        cache: this.masterCache,
        eventBus: this.eventBus,
        logger: this.logger.child('openInterest'),
      },
      { tickIntervalMs: 2000, symbolsPerTick: 10 }
    );

    /** @type {WorkerPoolManager} */
    this.workerPool = new WorkerPoolManager(
      { eventBus: this.eventBus, logger: this.logger.child('workers'), healthMonitor: this.healthMonitor },
      this.config
    );

    /** @private */
    this._metricsTimer = null;
    /** @private */
    this._started = false;
  }

  /**
   * Start the scanner: refresh the symbol registry, spawn the worker
   * pool distributed across the discovered symbols, and start health
   * + metrics monitoring loops.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;

    this.logger.info('Starting Binance Institutional Scanner', { environment: this.config.environment });

    await this.symbolRegistry.start();
    const symbols = this.symbolRegistry.getSymbolNames();
    if (symbols.length === 0) {
      throw new Error('ScannerManager: symbol registry returned zero tradable symbols — aborting startup');
    }

    this.openInterestPoller.setSymbols(symbols);
    this.openInterestPoller.start();

    await this.workerPool.start(symbols);

    this.healthMonitor.start();

    this._metricsTimer = setInterval(() => this.metrics.sample(), this.config.metrics.sampleIntervalMs);
    this._metricsTimer.unref?.();

    // Keep the OI poller's symbol list current across registry refreshes.
    this.eventBus.on('registry:refreshed', () => {
      this.openInterestPoller.setSymbols(this.symbolRegistry.getSymbolNames());
    });

    this._started = true;
    this.logger.info('Scanner started', { symbolCount: symbols.length, workerCount: this.workerPool.getWorkers().length });
  }

  /**
   * Retrieve a fresh, aggregated snapshot of every symbol's cached
   * market data across all worker threads, merged with master-side
   * open-interest data (workers do not poll OI themselves).
   * @returns {Promise<Array<import('./cache/CoinCache.js').CoinCacheEntry>>}
   */
  async getMarketSnapshot() {
    const workerEntries = await this.workerPool.getAggregatedCacheSnapshot();
    return workerEntries.map((entry) => {
      const oiEntry = this.masterCache.get(entry.symbol);
      return oiEntry && oiEntry.openInterest !== null
        ? { ...entry, openInterest: oiEntry.openInterest }
        : entry;
    });
  }

  /**
   * Gracefully stop everything: registry refresh timer, OI poller,
   * worker pool (each worker closes its websocket cleanly), health
   * monitor, and the logger's file stream.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._started) return;
    this.logger.info('Stopping scanner');

    if (this._metricsTimer) {
      clearInterval(this._metricsTimer);
      this._metricsTimer = null;
    }
    this.healthMonitor.stop();
    this.openInterestPoller.stop();
    this.symbolRegistry.stop();
    await this.workerPool.shutdown();

    this._started = false;
    await this.logger.close();
  }

  /**
   * @returns {boolean}
   */
  get isRunning() {
    return this._started;
  }
}

export default ScannerManager;
