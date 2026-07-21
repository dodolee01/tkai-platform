/**
 * @file Monitors the 11 platform modules (Indicators, Scanner,
 * Decision, Risk, Learning, Execution, Position, Portfolio,
 * Notification, Analytics, AI Core) via injected health-check
 * functions — one per module, each a thin wrapper around that
 * module's own status/health API (duck-typed, never imported directly).
 * @module monitoring-engine/ModuleHealthMonitor
 */

/** @type {string[]} The 11 documented platform modules this monitor covers. */
export const PLATFORM_MODULES = Object.freeze([
  'indicators', 'scanner', 'decision', 'risk', 'learning',
  'execution', 'position', 'portfolio', 'notification', 'analytics', 'ai-core',
]);

export class ModuleHealthMonitor {
  /**
   * @param {import('./HealthChecker.js').HealthChecker} healthChecker
   */
  constructor(healthChecker) {
    /** @private */ this._healthChecker = healthChecker;
    /** @private @type {Map<string, () => Promise<object>>} */
    this._checks = new Map();
  }

  /**
   * @param {string} moduleName - One of {@link PLATFORM_MODULES}, or a custom name for a future module.
   * @param {() => Promise<{status?: import('./types.js').HealthStatus, message?: string, details?: object}>} checkFn
   * @returns {void}
   */
  registerModule(moduleName, checkFn) {
    if (typeof checkFn !== 'function') throw new Error('ModuleHealthMonitor.registerModule: checkFn must be a function');
    this._checks.set(moduleName, checkFn);
  }

  /**
   * @param {string} moduleName
   * @returns {boolean}
   */
  isRegistered(moduleName) {
    return this._checks.has(moduleName);
  }

  /**
   * @returns {string[]}
   */
  getRegisteredModules() {
    return Array.from(this._checks.keys());
  }

  /**
   * @param {string} moduleName
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   * @throws {Error} If the module has no registered check.
   */
  async checkModule(moduleName) {
    const checkFn = this._checks.get(moduleName);
    if (!checkFn) throw new Error(`ModuleHealthMonitor: no health check registered for module "${moduleName}"`);
    return this._healthChecker.check(moduleName, checkFn);
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult[]>}
   */
  async checkAllModules() {
    const checksByName = Object.fromEntries(this._checks.entries());
    return this._healthChecker.checkAll(checksByName);
  }
}

export default { ModuleHealthMonitor, PLATFORM_MODULES };
