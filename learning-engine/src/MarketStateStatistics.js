/**
 * @file Performance tracked independently per market regime
 * (TRENDING, RANGING, BREAKOUT, REVERSAL, HIGH_VOLATILITY,
 * LOW_VOLATILITY, NEWS_RISK — see Config.js MARKET_REGIMES).
 * @module learning-engine/MarketStateStatistics
 */

import { analyzeByGroup } from './PerformanceAnalyzer.js';

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {object} performanceConfig
 * @returns {import('./types.js').MarketStatePerformance[]}
 */
export function computeMarketStatePerformance(trades, performanceConfig) {
  const { groups } = analyzeByGroup(trades, (t) => t.marketState || 'unknown', performanceConfig);
  return Object.entries(groups)
    .map(([marketState, group]) => {
      const { trades: groupTrades, ...stats } = group;
      return { marketState, trades: groupTrades.length, stats };
    })
    .sort((a, b) => b.stats.expectancy - a.stats.expectancy);
}

/**
 * @param {import('./types.js').MarketStatePerformance[]} marketStatePerformance
 * @param {string[]} configuredRegimes
 * @returns {string[]} Configured regimes with zero observed trades so far.
 */
export function findUnobservedRegimes(marketStatePerformance, configuredRegimes) {
  const observed = new Set(marketStatePerformance.map((m) => m.marketState));
  return configuredRegimes.filter((regime) => !observed.has(regime));
}

export default { computeMarketStatePerformance, findUnobservedRegimes };
