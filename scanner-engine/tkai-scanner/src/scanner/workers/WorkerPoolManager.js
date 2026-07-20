/**
 * @file Master-side worker pool manager. Splits the symbol universe
 * across N worker threads, forwards their events onto the master
 * {@link EventBus}, monitors their heartbeats, and coordinates
 * graceful shutdown.
 * @module scanner/workers/WorkerPoolManager
 */

import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { distributeEvenly } from '../websocket/StreamBatcher.js';
import { ScannerEvents } from '../core/EventBus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_ENTRY_PATH = join(__dirname, 'scannerWorker.js');

/**
 * @typedef {Object} ManagedWorker
 * @property {string} id
 * @property {Worker} worker
 * @property {string[]} symbols
 * @property {'starting'|'ready'|'error'|'stopped'} status
 */

/**
 * Owns and coordinates a pool of scanner worker threads.
 * Master <-> worker communication happens exclusively via
 * `postMessage`/`parentPort`; this class re-publishes every worker
 * event onto the shared master {@link EventBus} so downstream
 * consumers (cache aggregator, AI decision engine, etc.) don't need
 * to know whether data originated from a worker or the main thread.
 */
export class WorkerPoolManager {
  /**
   * @param {Object} deps
   * @param {import('../core/EventBus.js').EventBus} deps.eventBus
   * @param {import('../core/Logger.js').Logger} deps.logger
   * @param {import('../core/HealthMonitor.js').HealthMonitor} [deps.healthMonitor]
   * @param {Object} config - The active scanner configuration (see config/index.js).
   * @param {new (...args:any[]) => Worker} [WorkerImpl] - Injected Worker constructor, defaults to `node:worker_threads`'s Worker (DI for testability).
   */
  constructor({ eventBus, logger, healthMonitor }, config, WorkerImpl = Worker) {
    /** @private */ this._eventBus = eventBus;
    /** @private */ this._logger = logger;
    /** @private */ this._healthMonitor = healthMonitor;
    /** @private */ this._config = config;
    /** @private */ this._WorkerImpl = WorkerImpl;

    /** @private @type {Map<string, ManagedWorker>} */
    this._workers = new Map();
    /** @private @type {Map<string, {resolve:Function, reject:Function}>} */
    this._pendingCacheRequests = new Map();
  }

  /**
   * Partition `symbols` evenly across `config.workers.poolSize`
   * worker threads and spawn each one.
   * @param {string[]} symbols
   * @returns {Promise<void>} Resolves once every worker has reported `ready`.
   */
  async start(symbols) {
    const poolSize = Math.max(1, this._config.workers.poolSize);
    const groups = distributeEvenly(symbols, poolSize);

    const readyPromises = groups.map((symbolGroup, idx) => {
      if (symbolGroup.length === 0) return Promise.resolve();
      const workerId = `worker-${idx}`;
      return this._spawnWorker(workerId, symbolGroup);
    });

    await Promise.all(readyPromises);
    this._logger?.info('Worker pool started', { poolSize, totalSymbols: symbols.length });
  }

  /**
   * @param {string} workerId
   * @param {string[]} symbols
   * @returns {Promise<void>} Resolves when this worker reports `ready`.
   * @private
   */
  _spawnWorker(workerId, symbols) {
    return new Promise((resolve, reject) => {
      const worker = new this._WorkerImpl(WORKER_ENTRY_PATH, {
        workerData: {
          workerId,
          symbols,
          wsBaseUrl: this._config.binance.wsBaseUrl,
          config: this._config,
        },
      });

      const managed = { id: workerId, worker, symbols, status: 'starting' };
      this._workers.set(workerId, managed);

      this._healthMonitor?.registerWorker(workerId, () => this._restartWorker(workerId));

      let settled = false;

      worker.on('message', (msg) => this._handleWorkerMessage(workerId, msg, { resolve, settled: () => (settled = true), isSettled: () => settled }));

      worker.on('error', (err) => {
        this._logger?.error('Worker thread error', { workerId, error: err.message });
        managed.status = 'error';
        this._eventBus?.safeEmit(ScannerEvents.WORKER_ERROR, { workerId, error: err.message });
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      worker.on('exit', (code) => {
        this._logger?.warn('Worker thread exited', { workerId, code });
        if (managed.status !== 'stopped') {
          managed.status = 'error';
          this._eventBus?.safeEmit(ScannerEvents.WORKER_ERROR, { workerId, error: `exited with code ${code}` });
        }
      });
    });
  }

  /**
   * @param {string} workerId
   * @param {object} msg
   * @param {{resolve:Function, settled:Function, isSettled:() => boolean}} readyCallbacks
   * @returns {void}
   * @private
   */
  _handleWorkerMessage(workerId, msg, { resolve, settled, isSettled }) {
    const managed = this._workers.get(workerId);
    if (!managed) return;

    switch (msg.type) {
      case 'ready':
        managed.status = 'ready';
        this._eventBus?.safeEmit(ScannerEvents.WORKER_ONLINE, { workerId, symbolCount: msg.symbolCount });
        this._logger?.info('Worker ready', { workerId, symbolCount: msg.symbolCount });
        if (!isSettled()) {
          settled();
          resolve();
        }
        break;
      case 'event':
        this._eventBus?.safeEmit(msg.eventName, msg.payload);
        break;
      case 'heartbeat':
        this._healthMonitor?.recordWorkerHeartbeat(workerId);
        break;
      case 'metrics':
        this._eventBus?.safeEmit('worker:metrics', { workerId, snapshot: msg.snapshot });
        break;
      case 'error':
        this._logger?.error('Worker reported error', { workerId, error: msg.error, fatal: msg.fatal });
        this._eventBus?.safeEmit(ScannerEvents.WORKER_ERROR, { workerId, error: msg.error });
        if (!isSettled()) {
          settled();
          // Do not reject startup on a non-fatal error; only fatal errors block readiness.
          if (msg.fatal) this._restartWorker(workerId);
          else resolve();
        }
        break;
      case 'cacheSnapshot': {
        const pending = this._pendingCacheRequests.get(msg.requestId);
        if (pending) {
          pending.resolve(msg.data);
          this._pendingCacheRequests.delete(msg.requestId);
        }
        break;
      }
      case 'shutdown-complete':
        managed.status = 'stopped';
        this._eventBus?.safeEmit(ScannerEvents.WORKER_SHUTDOWN, { workerId });
        break;
      default:
        this._logger?.debug('Unknown worker message type', { workerId, type: msg.type });
    }
  }

  /**
   * Terminate and respawn a worker in place (used for frozen-worker
   * recovery by the {@link HealthMonitor}).
   * @param {string} workerId
   * @returns {Promise<void>}
   * @private
   */
  async _restartWorker(workerId) {
    const managed = this._workers.get(workerId);
    if (!managed) return;
    this._logger?.warn('Restarting worker', { workerId });
    try {
      await managed.worker.terminate();
    } catch (err) {
      this._logger?.error('Failed to terminate frozen worker', { workerId, error: err.message });
    }
    this._healthMonitor?.unregisterWorker(workerId);
    await this._spawnWorker(workerId, managed.symbols).catch((err) =>
      this._logger?.error('Failed to respawn worker', { workerId, error: err.message })
    );
  }

  /**
   * Request an aggregated snapshot of every worker's in-memory cache.
   * @returns {Promise<Array<import('../cache/CoinCache.js').CoinCacheEntry>>}
   */
  async getAggregatedCacheSnapshot() {
    const requests = Array.from(this._workers.values())
      .filter((w) => w.status === 'ready')
      .map(
        (managed) =>
          new Promise((resolve, reject) => {
            const requestId = `${managed.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            this._pendingCacheRequests.set(requestId, { resolve, reject });
            managed.worker.postMessage({ type: 'getCacheSnapshot', requestId });
            setTimeout(() => {
              if (this._pendingCacheRequests.has(requestId)) {
                this._pendingCacheRequests.delete(requestId);
                reject(new Error(`Cache snapshot request to ${managed.id} timed out`));
              }
            }, 5000).unref?.();
          })
      );

    const results = await Promise.allSettled(requests);
    return results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }

  /**
   * Gracefully shut down every worker: signal shutdown, wait for
   * acknowledgement (bounded by a timeout), then terminate any that
   * did not respond in time.
   * @returns {Promise<void>}
   */
  async shutdown() {
    const shutdowns = Array.from(this._workers.values()).map(
      (managed) =>
        new Promise((resolve) => {
          const timeout = setTimeout(async () => {
            await managed.worker.terminate();
            resolve();
          }, 10000);
          timeout.unref?.();

          const onExit = () => {
            clearTimeout(timeout);
            resolve();
          };
          managed.worker.once('exit', onExit);
          managed.worker.postMessage({ type: 'shutdown' });
        })
    );
    await Promise.all(shutdowns);
    this._workers.clear();
    this._logger?.info('Worker pool shut down');
  }

  /**
   * @returns {ManagedWorker[]}
   */
  getWorkers() {
    return Array.from(this._workers.values());
  }
}

export default WorkerPoolManager;
