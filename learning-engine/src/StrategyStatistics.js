/**
 * @file Performance grouped by "strategy". The `CompletedTrade`
 * contract (see types.js, matching the Decision Engine's payload)
 * has no explicit `strategy` field, so this module derives a strategy
 * key from configurable trade fields — by default `decision:timeframe`
 * (e.g. "LONG:15m"). Callers with a richer strategy taxonomy can
 * supply their own key function via {@link buildStrategyKeyFn}.
 * @module learning-engine/StrategyStatistics
 */

import { analyzeByGroup } from './PerformanceAnalyzer.js';

/**
 * Build a strategy-key extractor function from a list of trade field
 * names, joined with ':'. This is the default strategy definition;
 * pass a custom function directly to {@link computeStrategyPerformance}
 * instead if your deployment has a dedicated strategy identifier.
 * @param {string[]} fields
 * @returns {(trade: import('./types.js').CompletedTrade) => string}
 */
export function buildStrategyKeyFn(fields) {
  return (trade) => fields.map((f) => String(trade[f] ?? 'unknown')).join(':');
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {(trade: import('./types.js').CompletedTrade) => string} strategyKeyFn
 * @param {object} performanceConfig
 * @returns {import('./types.js').StrategyPerformance[]}
 */
export function computeStrategyPerformance(trades, strategyKeyFn, performanceConfig) {
  const { groups } = analyzeByGroup(trades, strategyKeyFn, performanceConfig);
  return Object.entries(groups)
    .map(([strategyKey, group]) => {
      const { trades: groupTrades, ...stats } = group;
      return { strategyKey, trades: groupTrades.length, stats };
    })
    .sort((a, b) => b.stats.expectancy - a.stats.expectancy);
}

export default { buildStrategyKeyFn, computeStrategyPerformance };
