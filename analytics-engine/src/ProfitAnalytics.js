/**
 * @file Profit-side analytics: net/gross profit, profit factor,
 * profit distribution (histogram), profit frequency, and average
 * daily/monthly profit.
 * @module analytics-engine/ProfitAnalytics
 */

import { MetricsEngine } from './MetricsEngine.js';
import { dayKey, monthKey, percentile } from './StatisticsEngine.js';

/**
 * Bucket winning trades' PnL into a fixed-count histogram — a simple,
 * deterministic profit-distribution representation (10 equal-width
 * buckets between the smallest and largest win).
 * @param {number[]} winningPnls
 * @param {number} [bucketCount=10]
 * @returns {{bucketStart: number, bucketEnd: number, count: number}[]}
 */
export function computeProfitDistribution(winningPnls, bucketCount = 10) {
  if (winningPnls.length === 0) return [];
  const min = Math.min(...winningPnls);
  const max = Math.max(...winningPnls);
  if (min === max) return [{ bucketStart: min, bucketEnd: max, count: winningPnls.length }];

  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    bucketStart: min + i * width,
    bucketEnd: min + (i + 1) * width,
    count: 0,
  }));
  for (const pnl of winningPnls) {
    const idx = Math.min(bucketCount - 1, Math.floor((pnl - min) / width));
    buckets[idx].count += 1;
  }
  return buckets;
}

/**
 * @typedef {Object} ProfitAnalyticsReport
 * @property {number} netProfit
 * @property {number} grossProfit
 * @property {number} grossLoss
 * @property {number} profitFactor
 * @property {{bucketStart: number, bucketEnd: number, count: number}[]} profitDistribution
 * @property {number} profitFrequency - Fraction of all trades that were profitable (alias of win rate, reported here for profit-centric context).
 * @property {number} averageDailyProfit
 * @property {number} averageMonthlyProfit
 * @property {number} medianWin
 */

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {ProfitAnalyticsReport}
 */
export function computeProfitAnalytics(trades) {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);

  const winningPnls = trades.filter((t) => t.realizedPnl > 0).map((t) => t.realizedPnl);

  const dailyPnl = new Map();
  const monthlyPnl = new Map();
  for (const trade of trades) {
    const d = dayKey(trade.closedAt);
    const m = monthKey(trade.closedAt);
    dailyPnl.set(d, (dailyPnl.get(d) || 0) + trade.realizedPnl);
    monthlyPnl.set(m, (monthlyPnl.get(m) || 0) + trade.realizedPnl);
  }
  const avg = (map) => (map.size === 0 ? 0 : Array.from(map.values()).reduce((a, b) => a + b, 0) / map.size);

  return {
    netProfit: engine.netProfit,
    grossProfit: engine.grossProfit,
    grossLoss: engine.grossLoss,
    profitFactor: engine.profitFactor,
    profitDistribution: computeProfitDistribution(winningPnls),
    profitFrequency: engine.winRate,
    averageDailyProfit: avg(dailyPnl),
    averageMonthlyProfit: avg(monthlyPnl),
    medianWin: winningPnls.length === 0 ? 0 : percentile(winningPnls, 0.5),
  };
}

export default { computeProfitDistribution, computeProfitAnalytics };
