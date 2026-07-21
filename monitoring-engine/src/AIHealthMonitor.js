/**
 * @file AI subsystem health monitoring: provider availability,
 * response time, token usage, cost, and failover activity. Reads
 * from a duck-typed snapshot matching Module 11's AI Core Engine
 * shapes (`AIProviderManager.getHealth()`, `TokenManager.getTotals()`,
 * `CostManager.checkBudget()`) — supplied via an injected accessor
 * function, never by importing Module 11's source directly.
 * @module monitoring-engine/AIHealthMonitor
 */

import { HealthStatus } from './HealthChecker.js';

export class AIHealthMonitor {
  /**
   * @param {Object} deps
   * @param {() => Promise<{providers: {name: string, available: boolean, averageLatencyMs: number, consecutiveFailures: number}[], tokenTotals: {totalTokens: number}, costSummary: {spentUsd: number, budgetUsd: number, withinBudget: boolean}, failoverCount: number}>} deps.getAISnapshot - Injected accessor over Module 11's live state.
   */
  constructor({ getAISnapshot }) {
    if (typeof getAISnapshot !== 'function') throw new Error('AIHealthMonitor: getAISnapshot dependency is required');
    /** @private */ this._getAISnapshot = getAISnapshot;
  }

  /**
   * @returns {Promise<{status: import('./types.js').HealthStatus, providers: object[], availableProviderCount: number, totalTokens: number, costWithinBudget: boolean, failoverCount: number}>}
   */
  async check() {
    const snapshot = await this._getAISnapshot();
    const availableProviderCount = snapshot.providers.filter((p) => p.available).length;

    let status;
    if (availableProviderCount === 0) status = HealthStatus.OFFLINE;
    else if (!snapshot.costSummary.withinBudget || availableProviderCount < snapshot.providers.length) status = HealthStatus.WARNING;
    else status = HealthStatus.HEALTHY;

    return {
      status,
      providers: snapshot.providers,
      availableProviderCount,
      totalTokens: snapshot.tokenTotals.totalTokens,
      costWithinBudget: snapshot.costSummary.withinBudget,
      failoverCount: snapshot.failoverCount,
    };
  }
}

export default AIHealthMonitor;
