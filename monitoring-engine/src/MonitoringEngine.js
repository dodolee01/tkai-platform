/**
 * @file The monitoring engine orchestrator — wires the service
 * registry, dependency graph, heartbeat/health managers, every
 * concrete monitor, the watchdog, incident/recovery management, and
 * alert dispatching into a single public API. This is the module's
 * sole integration point: every other engine in the platform
 * registers itself here and sends heartbeats through it. This module
 * never executes trades and never depends on any other module for
 * its own operation — it must be able to observe a module even while
 * that module is failing.
 * @module monitoring-engine/MonitoringEngine
 */

import { createConfig } from './Config.js';
import { MonitoringEventPublisher } from './MonitoringEvents.js';
import { HealthChecker } from './HealthChecker.js';
import { ServiceRegistry } from './ServiceRegistry.js';
import { DependencyGraph } from './DependencyGraph.js';
import { HeartbeatManager } from './HeartbeatManager.js';
import { MetricsCollector } from './MetricsCollector.js';
import { CPUMonitor } from './CPUMonitor.js';
import { MemoryMonitor } from './MemoryMonitor.js';
import { DiskMonitor } from './DiskMonitor.js';
import { NetworkMonitor } from './NetworkMonitor.js';
import { ProcessMonitor } from './ProcessMonitor.js';
import { SystemMetrics } from './SystemMetrics.js';
import { ModuleHealthMonitor } from './ModuleHealthMonitor.js';
import { HealthManager } from './HealthManager.js';
import { Watchdog } from './Watchdog.js';
import { IncidentManager } from './IncidentManager.js';
import { RecoveryManager } from './RecoveryManager.js';
import { AutoRestartManager } from './AutoRestartManager.js';
import { AlertDispatcher } from './AlertDispatcher.js';
import { StatusAggregator } from './StatusAggregator.js';

export class MonitoringEngine {
  /**
   * @param {Object} [deps]
   * @param {(request: object) => (object|Promise<object>)} [deps.notify] - Injected Module 9 `notify()` accessor; if omitted, alerting is disabled but everything else still works.
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ notify, logger = null } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._logger = logger;

    /** @type {MonitoringEventPublisher} */
    this.eventPublisher = new MonitoringEventPublisher();
    /** @type {HealthChecker} */
    this.healthChecker = new HealthChecker(this.config.healthCheck);
    /** @type {ServiceRegistry} */
    this.serviceRegistry = new ServiceRegistry();
    /** @type {DependencyGraph} */
    this.dependencyGraph = new DependencyGraph();
    /** @type {HeartbeatManager} */
    this.heartbeatManager = new HeartbeatManager({ serviceRegistry: this.serviceRegistry, eventPublisher: this.eventPublisher }, this.config.heartbeat);

    /** @type {MetricsCollector} */
    this.metricsCollector = new MetricsCollector();
    /** @type {ProcessMonitor} */
    this.processMonitor = new ProcessMonitor();
    /** @type {SystemMetrics} */
    this.systemMetrics = new SystemMetrics(
      {
        cpuMonitor: new CPUMonitor(), memoryMonitor: new MemoryMonitor(), diskMonitor: new DiskMonitor(),
        networkMonitor: new NetworkMonitor(), processMonitor: this.processMonitor, metricsCollector: this.metricsCollector,
      },
      this.config
    );

    /** @type {ModuleHealthMonitor} */
    this.moduleHealthMonitor = new ModuleHealthMonitor(this.healthChecker);

    /** @type {AlertDispatcher|null} */
    this.alertDispatcher = notify ? new AlertDispatcher({ notify, logger }) : null;

    /** @type {HealthManager} */
    this.healthManager = new HealthManager({
      serviceRegistry: this.serviceRegistry, moduleHealthMonitor: this.moduleHealthMonitor,
      eventPublisher: this.eventPublisher, alertDispatcher: this.alertDispatcher, logger,
    });

    /** @type {Watchdog} */
    this.watchdog = new Watchdog(
      { metricsCollector: this.metricsCollector, processMonitor: this.processMonitor, heartbeatManager: this.heartbeatManager },
      this.config
    );
    /** @type {IncidentManager} */
    this.incidentManager = new IncidentManager(this.eventPublisher);
    /** @type {RecoveryManager} */
    this.recoveryManager = new RecoveryManager(this.eventPublisher, this.config.recovery);
    /** @type {AutoRestartManager} */
    this.autoRestartManager = new AutoRestartManager({ recoveryManager: this.recoveryManager, eventPublisher: this.eventPublisher, logger });
    /** @type {StatusAggregator} */
    this.statusAggregator = new StatusAggregator(this.serviceRegistry);

    /** @private */ this._monitoringTimer = null;
  }

  /**
   * Register a service (module, database, exchange, websocket, api,
   * ai, or system) to be tracked. Call this once per service at startup.
   * @param {Object} params
   * @param {string} params.name
   * @param {string} [params.version]
   * @param {'module'|'database'|'exchange'|'websocket'|'api'|'ai'|'system'} params.category
   * @param {string[]} [params.dependencies]
   * @returns {import('./types.js').ServiceRecord}
   */
  registerService({ name, version, category, dependencies = [] }) {
    const record = this.serviceRegistry.register({ name, version, category, dependencies });
    this.dependencyGraph.setDependencies(name, dependencies);
    return record;
  }

  /**
   * Register a health check for a module (one of the 11 platform modules).
   * @param {string} moduleName
   * @param {() => Promise<object>} checkFn
   * @returns {void}
   */
  registerModuleHealthCheck(moduleName, checkFn) {
    this.moduleHealthMonitor.registerModule(moduleName, checkFn);
  }

  /**
   * Register an additional (non-module) health check — database,
   * exchange, AI subsystem, etc.
   * @param {string} serviceName
   * @param {() => Promise<import('./types.js').HealthCheckResult>} checkFn
   * @returns {void}
   */
  registerHealthCheck(serviceName, checkFn) {
    this.healthManager.registerCheck(serviceName, checkFn);
  }

  /**
   * Register a recovery action for a service (restartModule,
   * reconnectWebSocket, reconnectExchange, reconnectDatabase,
   * clearCache, recoverSession).
   * @param {import('./types.js').RecoveryAction} action
   * @returns {void}
   */
  registerRecoveryAction(action) {
    this.recoveryManager.registerAction(action);
  }

  /**
   * Record a heartbeat from a service. Every module in the platform
   * should call this on its own interval.
   * @param {string} serviceName
   * @param {number} [sequence]
   * @returns {{accepted: boolean, reason: string|null}}
   */
  heartbeat(serviceName, sequence) {
    return this.heartbeatManager.beat(serviceName, sequence);
  }

  /**
   * Run one full monitoring cycle: system metrics collection, health
   * checks, heartbeat evaluation, and watchdog checks — followed by
   * automatic restart attempts for any hung service the watchdog finds.
   * @returns {Promise<{systemSnapshot: object, healthResults: object[], heartbeatResults: object[], watchdogResult: object}>}
   */
  async runMonitoringCycle() {
    const systemSnapshot = await this.systemMetrics.collect();
    const healthResults = await this.healthManager.runHealthChecks();
    const heartbeatResults = this.heartbeatManager.evaluateAll();
    const watchdogResult = this.watchdog.runAllChecks();

    if (watchdogResult.hungServices.length > 0) {
      await this.autoRestartManager.handleWatchdogResult(watchdogResult);
    }

    return { systemSnapshot, healthResults, heartbeatResults, watchdogResult };
  }

  /**
   * Start automatic periodic monitoring cycles.
   * @returns {void}
   */
  start() {
    if (this._monitoringTimer) return;
    this._monitoringTimer = setInterval(() => {
      this.runMonitoringCycle().catch((err) => this._logger?.error?.('MonitoringEngine: monitoring cycle failed', { error: err.message }));
    }, this.config.healthCheck.intervalMs);
    this._monitoringTimer.unref?.();
  }

  /**
   * Stop automatic periodic monitoring cycles.
   * @returns {void}
   */
  stop() {
    if (this._monitoringTimer) {
      clearInterval(this._monitoringTimer);
      this._monitoringTimer = null;
    }
  }

  /**
   * @returns {object} A compact, dashboard-ready snapshot of platform health.
   */
  getDashboardData() {
    return this.statusAggregator.getDashboardData();
  }

  /**
   * Graceful shutdown: stops the monitoring loop and releases
   * perf_hooks observers.
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.stop();
    this.processMonitor.stop();
  }
}

export default MonitoringEngine;
