/**
 * @file Mid-level orchestrator: runs every registered health check
 * (module + database + exchange + AI), updates
 * {@link ServiceRegistry}, detects status transitions, and fires
 * `healthChanged`/`moduleOffline`/`moduleRecovered` accordingly. This
 * is the periodic tick that keeps the registry's status fields
 * current — {@link MonitoringEngine} drives it on an interval.
 * @module monitoring-engine/HealthManager
 */

import { HealthStatus } from './HealthChecker.js';

export class HealthManager {
  /**
   * @param {Object} deps
   * @param {import('./ServiceRegistry.js').ServiceRegistry} deps.serviceRegistry
   * @param {import('./ModuleHealthMonitor.js').ModuleHealthMonitor} deps.moduleHealthMonitor
   * @param {import('./MonitoringEvents.js').MonitoringEventPublisher} deps.eventPublisher
   * @param {import('./AlertDispatcher.js').AlertDispatcher} [deps.alertDispatcher]
   * @param {import('./types.js').Logger} [deps.logger]
   */
  constructor({ serviceRegistry, moduleHealthMonitor, eventPublisher, alertDispatcher = null, logger = null }) {
    /** @private */ this._serviceRegistry = serviceRegistry;
    /** @private */ this._moduleHealthMonitor = moduleHealthMonitor;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._alertDispatcher = alertDispatcher;
    /** @private */ this._logger = logger;
    /** @private @type {Map<string, () => Promise<import('./types.js').HealthCheckResult>>} */
    this._extraChecks = new Map();
  }

  /**
   * Register an additional health check beyond the module checks
   * already registered with {@link ModuleHealthMonitor} — e.g. a
   * database, exchange, or AI-subsystem check.
   * @param {string} serviceName
   * @param {() => Promise<import('./types.js').HealthCheckResult>} checkFn
   * @returns {void}
   */
  registerCheck(serviceName, checkFn) {
    this._extraChecks.set(serviceName, checkFn);
  }

  /**
   * Run every registered check (module checks + any extra checks),
   * update the registry, and emit transition events.
   * @returns {Promise<import('./types.js').HealthCheckResult[]>}
   */
  async runHealthChecks() {
    const moduleResults = this._moduleHealthMonitor.getRegisteredModules().length > 0
      ? await this._moduleHealthMonitor.checkAllModules()
      : [];
    const extraResults = await Promise.all(
      Array.from(this._extraChecks.entries()).map(([, fn]) => fn())
    );

    const allResults = [...moduleResults, ...extraResults];
    for (const result of allResults) {
      await this._applyResult(result);
    }
    return allResults;
  }

  /**
   * @param {import('./types.js').HealthCheckResult} result
   * @returns {Promise<void>}
   * @private
   */
  async _applyResult(result) {
    if (!this._serviceRegistry.has(result.serviceName)) return; // only track services that were explicitly registered

    const previousStatus = this._serviceRegistry.get(result.serviceName).status;
    if (previousStatus === result.status) return;

    this._serviceRegistry.updateStatus(result.serviceName, result.status);
    this._eventPublisher.safeEmit('healthChanged', { serviceName: result.serviceName, previousStatus, status: result.status });

    if (result.status === HealthStatus.OFFLINE && previousStatus !== HealthStatus.OFFLINE) {
      this._eventPublisher.safeEmit('moduleOffline', { serviceName: result.serviceName, previousStatus });
    }
    if (previousStatus === HealthStatus.OFFLINE && result.status !== HealthStatus.OFFLINE) {
      this._eventPublisher.safeEmit('moduleRecovered', { serviceName: result.serviceName, status: result.status });
    }

    if (this._alertDispatcher) {
      await this._alertDispatcher.dispatchHealthChanged(result.serviceName, previousStatus, result.status);
    }
  }

  /**
   * @param {string} serviceName
   * @returns {import('./types.js').HealthStatus|undefined}
   */
  getCurrentStatus(serviceName) {
    return this._serviceRegistry.get(serviceName)?.status;
  }
}

export default HealthManager;
