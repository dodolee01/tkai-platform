/**
 * @file Health monitor: detects dead sockets, frozen workers, resource
 * pressure, and reconnect loops, and triggers automatic recovery hooks.
 * @module scanner/core/HealthMonitor
 */

import { ScannerEvents } from './EventBus.js';

/**
 * @typedef {Object} HealthCheckable
 * @property {() => 'idle'|'connecting'|'open'|'closing'|'closed'} getState
 * @property {() => Promise<void>} reconnectOrRecover - Called when this checkable is judged unhealthy.
 * @property {string} id
 */

/**
 * Periodically evaluates system health against configured thresholds
 * and invokes recovery hooks. Does not own any timers on the checked
 * subsystems themselves — it purely observes state that others report
 * (websocket state, worker heartbeats, metrics snapshots) and reacts.
 */
export class HealthMonitor {
  /**
   * @param {Object} deps
   * @param {import('./Metrics.js').Metrics} deps.metrics
   * @param {import('./EventBus.js').EventBus} deps.eventBus
   * @param {import('./Logger.js').Logger} [deps.logger]
   * @param {Object} [options]
   * @param {number} [options.checkIntervalMs=10000]
   * @param {number} [options.memoryWarnMb=1024]
   * @param {number} [options.memoryCriticalMb=2048]
   * @param {number} [options.cpuWarnPct=75]
   * @param {number} [options.cpuCriticalPct=92]
   * @param {number} [options.reconnectLoopThreshold=5] - Reconnects within the window that constitute a loop.
   * @param {number} [options.reconnectLoopWindowMs=60000]
   * @param {number} [options.workerFrozenThresholdMs=20000] - No heartbeat within this window = frozen.
   */
  constructor(
    { metrics, eventBus, logger },
    {
      checkIntervalMs = 10000,
      memoryWarnMb = 1024,
      memoryCriticalMb = 2048,
      cpuWarnPct = 75,
      cpuCriticalPct = 92,
      reconnectLoopThreshold = 5,
      reconnectLoopWindowMs = 60000,
      workerFrozenThresholdMs = 20000,
    } = {}
  ) {
    /** @private */ this._metrics = metrics;
    /** @private */ this._eventBus = eventBus;
    /** @private */ this._logger = logger;

    /** @type {number} */ this.checkIntervalMs = checkIntervalMs;
    /** @type {number} */ this.memoryWarnMb = memoryWarnMb;
    /** @type {number} */ this.memoryCriticalMb = memoryCriticalMb;
    /** @type {number} */ this.cpuWarnPct = cpuWarnPct;
    /** @type {number} */ this.cpuCriticalPct = cpuCriticalPct;
    /** @type {number} */ this.reconnectLoopThreshold = reconnectLoopThreshold;
    /** @type {number} */ this.reconnectLoopWindowMs = reconnectLoopWindowMs;
    /** @type {number} */ this.workerFrozenThresholdMs = workerFrozenThresholdMs;

    /** @private @type {Map<string, {lastHeartbeat:number, onFrozen:() => void}>} */
    this._workers = new Map();
    /** @private @type {Map<string, {lastState:string, onDead:() => Promise<void>|void}>} */
    this._connections = new Map();
    /** @private @type {number[]} */
    this._reconnectTimestamps = [];
    /** @private */
    this._timer = null;
    /** @private @type {'healthy'|'warning'|'critical'} */
    this._status = 'healthy';
  }

  /**
   * Register a worker to be monitored for freezing (missed heartbeats).
   * @param {string} workerId
   * @param {() => void} onFrozen - Called (once) when the worker is judged frozen.
   * @returns {void}
   */
  registerWorker(workerId, onFrozen) {
    this._workers.set(workerId, { lastHeartbeat: Date.now(), onFrozen });
  }

  /**
   * Record a heartbeat from a monitored worker.
   * @param {string} workerId
   * @returns {void}
   */
  recordWorkerHeartbeat(workerId) {
    const entry = this._workers.get(workerId);
    if (entry) entry.lastHeartbeat = Date.now();
  }

  /**
   * Stop monitoring a worker (e.g. on graceful shutdown).
   * @param {string} workerId
   * @returns {void}
   */
  unregisterWorker(workerId) {
    this._workers.delete(workerId);
  }

  /**
   * Register a connection to be monitored for dead/closed state.
   * @param {string} connectionId
   * @param {() => string} getState - Returns the connection's current state string.
   * @param {() => Promise<void>|void} onDead - Recovery hook invoked when dead state is observed.
   * @returns {void}
   */
  registerConnection(connectionId, getState, onDead) {
    this._connections.set(connectionId, { getState, onDead });
  }

  /**
   * Stop monitoring a connection.
   * @param {string} connectionId
   * @returns {void}
   */
  unregisterConnection(connectionId) {
    this._connections.delete(connectionId);
  }

  /**
   * Record that a reconnect just occurred (fed by websocket layer),
   * used to detect reconnect loops (thrashing connections).
   * @returns {void}
   */
  recordReconnect() {
    const now = Date.now();
    this._reconnectTimestamps.push(now);
    const cutoff = now - this.reconnectLoopWindowMs;
    this._reconnectTimestamps = this._reconnectTimestamps.filter((t) => t >= cutoff);
  }

  /**
   * Run a single health evaluation pass. Safe to call directly in
   * tests without starting the timer loop.
   * @returns {{status:'healthy'|'warning'|'critical', issues:string[]}}
   */
  check() {
    const issues = [];
    let severity = 'healthy';

    const snapshot = this._metrics?.lastSnapshot;
    if (snapshot) {
      if (snapshot.memoryRssMb >= this.memoryCriticalMb) {
        issues.push(`memory critical: ${snapshot.memoryRssMb.toFixed(1)}MB >= ${this.memoryCriticalMb}MB`);
        severity = 'critical';
      } else if (snapshot.memoryRssMb >= this.memoryWarnMb) {
        issues.push(`memory warning: ${snapshot.memoryRssMb.toFixed(1)}MB >= ${this.memoryWarnMb}MB`);
        if (severity !== 'critical') severity = 'warning';
      }

      if (snapshot.cpuPct >= this.cpuCriticalPct) {
        issues.push(`cpu critical: ${snapshot.cpuPct.toFixed(1)}% >= ${this.cpuCriticalPct}%`);
        severity = 'critical';
      } else if (snapshot.cpuPct >= this.cpuWarnPct) {
        issues.push(`cpu warning: ${snapshot.cpuPct.toFixed(1)}% >= ${this.cpuWarnPct}%`);
        if (severity !== 'critical') severity = 'warning';
      }
    }

    if (this._reconnectTimestamps.length >= this.reconnectLoopThreshold) {
      issues.push(`reconnect loop detected: ${this._reconnectTimestamps.length} reconnects in ${this.reconnectLoopWindowMs}ms`);
      severity = 'critical';
    }

    const now = Date.now();
    for (const [workerId, entry] of this._workers) {
      const silentFor = now - entry.lastHeartbeat;
      if (silentFor >= this.workerFrozenThresholdMs) {
        issues.push(`worker frozen: ${workerId} silent for ${silentFor}ms`);
        severity = 'critical';
        this._eventBus?.safeEmit(ScannerEvents.WORKER_FROZEN, { workerId, silentForMs: silentFor });
        try {
          entry.onFrozen?.();
        } catch (err) {
          this._logger?.error('onFrozen recovery hook threw', { workerId, error: err.message });
        }
      }
    }

    for (const [connectionId, entry] of this._connections) {
      const state = entry.getState();
      if (state === 'closed') {
        issues.push(`connection dead: ${connectionId}`);
        if (severity === 'healthy') severity = 'warning';
        try {
          const result = entry.onDead?.();
          if (result?.catch) result.catch((err) => this._logger?.error('onDead recovery hook rejected', { connectionId, error: err.message }));
        } catch (err) {
          this._logger?.error('onDead recovery hook threw', { connectionId, error: err.message });
        }
      }
    }

    const previousStatus = this._status;
    this._status = severity;

    if (severity === 'critical') {
      this._eventBus?.safeEmit(ScannerEvents.HEALTH_CRITICAL, { issues });
      this._logger?.critical('Health check: critical', { issues });
    } else if (severity === 'warning') {
      this._eventBus?.safeEmit(ScannerEvents.HEALTH_WARNING, { issues });
      this._logger?.warn('Health check: warning', { issues });
    } else if (previousStatus !== 'healthy') {
      this._eventBus?.safeEmit(ScannerEvents.HEALTH_RECOVERED, {});
      this._logger?.info('Health check: recovered');
    }

    return { status: severity, issues };
  }

  /**
   * Start periodic health checks.
   * @returns {void}
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.check(), this.checkIntervalMs);
    this._timer.unref?.();
  }

  /**
   * Stop periodic health checks.
   * @returns {void}
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * @returns {'healthy'|'warning'|'critical'}
   */
  get status() {
    return this._status;
  }
}

export default HealthMonitor;
