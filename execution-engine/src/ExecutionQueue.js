/**
 * @file Serializes execution requests: at most one in-flight
 * operation per symbol at a time (preventing conflicting concurrent
 * orders on the same symbol), plus a global concurrency ceiling
 * across all symbols.
 * @module execution-engine/ExecutionQueue
 */

/**
 * @typedef {Object} QueuedTask
 * @property {string} symbol
 * @property {() => Promise<*>} task
 * @property {(value:*) => void} resolve
 * @property {(reason:*) => void} reject
 */

/**
 * FIFO execution queue with per-symbol serialization and a global
 * concurrency cap.
 */
export class ExecutionQueue {
  /**
   * @param {object} config - `config.queue` section.
   */
  constructor(config) {
    /** @private */ this._maxConcurrentGlobal = config.maxConcurrentGlobal;
    /** @private @type {QueuedTask[]} */ this._pending = [];
    /** @private @type {Set<string>} */ this._symbolsInFlight = new Set();
    /** @private */ this._activeGlobalCount = 0;
  }

  /**
   * Enqueue a task for a given symbol. Resolves/rejects with the
   * task's own result once it has run. Tasks for the same symbol run
   * strictly in submission order and never overlap with each other;
   * tasks for different symbols may run concurrently, up to
   * `maxConcurrentGlobal`.
   * @template T
   * @param {string} symbol
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  enqueue(symbol, task) {
    return new Promise((resolve, reject) => {
      this._pending.push({ symbol, task, resolve, reject });
      this._drain();
    });
  }

  /**
   * @returns {void}
   * @private
   */
  _drain() {
    if (this._activeGlobalCount >= this._maxConcurrentGlobal) return;

    const nextIndex = this._pending.findIndex((item) => !this._symbolsInFlight.has(item.symbol));
    if (nextIndex === -1) return;

    const [item] = this._pending.splice(nextIndex, 1);
    this._symbolsInFlight.add(item.symbol);
    this._activeGlobalCount += 1;

    const cleanupAndDrain = () => {
      this._symbolsInFlight.delete(item.symbol);
      this._activeGlobalCount -= 1;
      this._drain();
    };

    item.task().then(
      (result) => {
        cleanupAndDrain();
        item.resolve(result);
      },
      (err) => {
        cleanupAndDrain();
        item.reject(err);
      }
    );

    // Keep draining in case global capacity allows another symbol to start immediately.
    this._drain();
  }

  /**
   * @returns {number} Number of tasks waiting to start.
   */
  get pendingCount() {
    return this._pending.length;
  }

  /**
   * @returns {number} Number of tasks currently executing.
   */
  get activeCount() {
    return this._activeGlobalCount;
  }

  /**
   * @param {string} symbol
   * @returns {boolean}
   */
  isSymbolInFlight(symbol) {
    return this._symbolsInFlight.has(symbol);
  }
}

export default ExecutionQueue;
