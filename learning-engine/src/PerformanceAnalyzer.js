/**
 * @file Orchestrates {@link module:learning-engine/PerformanceMetrics}
 * over arbitrary trade subsets — the shared building block used by
 * StrategyStatistics, MarketStateStatistics, and the top-level
 * overall-performance report.
 * @module learning-engine/PerformanceAnalyzer
 */

import { computePerformanceStats } from './PerformanceMetrics.js';

/**
 * Compute overall performance stats plus a breakdown grouped by an
 * arbitrary key function.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {(trade: import('./types.js').CompletedTrade) => string} groupKeyFn
 * @param {object} performanceConfig - `config.performance` section.
 * @returns {{overall: import('./PerformanceMetrics.js').PerformanceStats, groups: Object.<string, import('./PerformanceMetrics.js').PerformanceStats & {trades: import('./types.js').CompletedTrade[]}>}}
 */
export function analyzeByGroup(trades, groupKeyFn, performanceConfig) {
  const overall = computePerformanceStats(trades, performanceConfig);

  /** @type {Map<string, import('./types.js').CompletedTrade[]>} */
  const buckets = new Map();
  for (const trade of trades) {
    const key = groupKeyFn(trade);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(trade);
  }

  const groups = {};
  for (const [key, groupTrades] of buckets) {
    groups[key] = { ...computePerformanceStats(groupTrades, performanceConfig), trades: groupTrades };
  }

  return { overall, groups };
}

/**
 * Compare a recent window of trades against the full historical set —
 * the shared comparison primitive used by overfitting detection
 * (spike/degradation checks).
 * @param {import('./types.js').CompletedTrade[]} trades - Chronologically ordered, oldest first.
 * @param {number} recentWindowSize
 * @param {object} performanceConfig
 * @returns {{recent: import('./PerformanceMetrics.js').PerformanceStats, historical: import('./PerformanceMetrics.js').PerformanceStats, recentTradeCount: number}}
 */
export function compareRecentToHistorical(trades, recentWindowSize, performanceConfig) {
  const recentTrades = trades.slice(-recentWindowSize);
  const historicalTrades = trades.slice(0, Math.max(0, trades.length - recentWindowSize));
  return {
    recent: computePerformanceStats(recentTrades, performanceConfig),
    historical: computePerformanceStats(historicalTrades, performanceConfig),
    recentTradeCount: recentTrades.length,
  };
}

export default { analyzeByGroup, compareRecentToHistorical };
