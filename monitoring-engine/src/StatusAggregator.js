/**
 * @file Produces rollup health summaries — Platform, Module,
 * Exchange, Database, AI, and System — from the {@link ServiceRegistry}
 * and the latest individual monitor results. This is the data source
 * for a future dashboard (per the module's explicit "no frontend"
 * scope) and for {@link HealthManager}'s overall status computation.
 * @module monitoring-engine/StatusAggregator
 */

import { HealthStatus } from './HealthChecker.js';

/** @type {string[]} Statuses ordered from most to least severe, for rollup computation. */
const SEVERITY_ORDER = [HealthStatus.OFFLINE, HealthStatus.CRITICAL, HealthStatus.WARNING, HealthStatus.MAINTENANCE, HealthStatus.HEALTHY];

/**
 * Roll up a set of individual statuses into one overall status: the
 * single most severe status present, or HEALTHY if the set is empty.
 * @param {import('./types.js').HealthStatus[]} statuses
 * @returns {import('./types.js').HealthStatus}
 */
export function rollupStatus(statuses) {
  if (statuses.length === 0) return HealthStatus.HEALTHY;
  for (const severity of SEVERITY_ORDER) {
    if (statuses.includes(severity)) return severity;
  }
  return HealthStatus.HEALTHY;
}

export class StatusAggregator {
  /**
   * @param {import('./ServiceRegistry.js').ServiceRegistry} serviceRegistry
   */
  constructor(serviceRegistry) {
    /** @private */ this._serviceRegistry = serviceRegistry;
  }

  /**
   * @param {'module'|'database'|'exchange'|'websocket'|'api'|'ai'|'system'} category
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getCategoryHealth(category) {
    const services = this._serviceRegistry.getAll(category);
    return { status: rollupStatus(services.map((s) => s.status)), services };
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getModuleHealth() {
    return this.getCategoryHealth('module');
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getExchangeHealth() {
    return this.getCategoryHealth('exchange');
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getDatabaseHealth() {
    return this.getCategoryHealth('database');
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getAIHealth() {
    return this.getCategoryHealth('ai');
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, services: import('./types.js').ServiceRecord[]}}
   */
  getSystemHealth() {
    return this.getCategoryHealth('system');
  }

  /**
   * @returns {{status: import('./types.js').HealthStatus, categories: Object.<string, import('./types.js').HealthStatus>, totalServices: number, healthyCount: number, warningCount: number, criticalCount: number, offlineCount: number}}
   */
  getPlatformHealth() {
    const allServices = this._serviceRegistry.getAll();
    const categories = {
      module: this.getModuleHealth().status,
      exchange: this.getExchangeHealth().status,
      database: this.getDatabaseHealth().status,
      ai: this.getAIHealth().status,
      system: this.getSystemHealth().status,
    };

    return {
      status: rollupStatus(Object.values(categories)),
      categories,
      totalServices: allServices.length,
      healthyCount: allServices.filter((s) => s.status === HealthStatus.HEALTHY).length,
      warningCount: allServices.filter((s) => s.status === HealthStatus.WARNING).length,
      criticalCount: allServices.filter((s) => s.status === HealthStatus.CRITICAL).length,
      offlineCount: allServices.filter((s) => s.status === HealthStatus.OFFLINE).length,
    };
  }

  /**
   * A compact, dashboard-ready snapshot bundling every rollup at once.
   * @returns {object}
   */
  getDashboardData() {
    return {
      generatedAt: Date.now(),
      platform: this.getPlatformHealth(),
      module: this.getModuleHealth(),
      exchange: this.getExchangeHealth(),
      database: this.getDatabaseHealth(),
      ai: this.getAIHealth(),
      system: this.getSystemHealth(),
    };
  }
}

export default { StatusAggregator, rollupStatus };
