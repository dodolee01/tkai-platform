/**
 * @file Trade-level analytics: counts, win/loss rates, average
 * win/loss, largest win/loss, average holding time, and trade
 * frequency (per day/week/month). Built on {@link MetricsEngine}
 * for the incremental aggregates, plus period-bucketing for frequency.
 * @module analytics-engine/TradeAnalytics
 */

import { MetricsEngine } from './MetricsEngine.js';
import { dayKey, weekKey, monthKey } from './StatisticsEngine.js';

/**
 * @typedef {Object} TradeAnalyticsReport
 * @property {number} totalTrades
 * @property {number} winningTrades
 * @property {number} losingTrades
 * @property {number} winRate
 * @property {number} averageWin
 * @property {number} averageLoss
 * @property {number} largestWin
 * @property {number} largestLoss
 * @property {number} averageHoldingTimeMs
 * @property {number} tradesPerDay
 * @property {number} tradesPerWeek
 * @property {number} tradesPerMonth
 */

/**
 * Compute a {@link TradeAnalyticsReport} from a trade list. Trade
 * frequency figures are the mean trade count observed per distinct
 * calendar day/week/month actually present in the data (not
 * normalized to a fixed external calendar range).
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {TradeAnalyticsReport}
 */
export function computeTradeAnalytics(trades) {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);

  const dayCounts = new Map();
  const weekCounts = new Map();
  const monthCounts = new Map();
  for (const trade of trades) {
    const d = dayKey(trade.closedAt);
    const w = weekKey(trade.closedAt);
    const m = monthKey(trade.closedAt);
    dayCounts.set(d, (dayCounts.get(d) || 0) + 1);
    weekCounts.set(w, (weekCounts.get(w) || 0) + 1);
    monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
  }

  const avg = (counts) => (counts.size === 0 ? 0 : Array.from(counts.values()).reduce((a, b) => a + b, 0) / counts.size);

  return {
    totalTrades: engine.totalTrades,
    winningTrades: engine.winCount,
    losingTrades: engine.lossCount,
    winRate: engine.winRate,
    averageWin: engine.averageWin,
    averageLoss: engine.averageLoss,
    largestWin: engine.largestWin,
    largestLoss: engine.largestLoss,
    averageHoldingTimeMs: engine.averageHoldingTimeMs,
    tradesPerDay: avg(dayCounts),
    tradesPerWeek: avg(weekCounts),
    tradesPerMonth: avg(monthCounts),
  };
}

export default { computeTradeAnalytics };
