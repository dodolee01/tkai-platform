/**
 * @file Heatmap data generation: profit/loss by hour-of-day and
 * day-of-week, plus hourly/daily/monthly performance grids.
 * @module analytics-engine/HeatmapGenerator
 */

import { dayKey, monthKey } from './StatisticsEngine.js';

/**
 * @param {number} timestamp
 * @returns {number} UTC hour of day, 0-23.
 * @private
 */
function hourOfDay(timestamp) {
  return new Date(timestamp).getUTCHours();
}

/**
 * @param {number} timestamp
 * @returns {number} UTC day of week, 0=Sunday..6=Saturday.
 * @private
 */
function dayOfWeek(timestamp) {
  return new Date(timestamp).getUTCDay();
}

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {(t: import('./types.js').TradeRecord) => (string|number)} rowFn
 * @param {(t: import('./types.js').TradeRecord) => (string|number)} colFn
 * @returns {import('./types.js').HeatmapCell[]}
 * @private
 */
function buildGrid(trades, rowFn, colFn) {
  /** @type {Map<string, {row: string|number, column: string|number, value: number, count: number}>} */
  const cells = new Map();
  for (const trade of trades) {
    const row = rowFn(trade);
    const column = colFn(trade);
    const key = `${row}::${column}`;
    if (!cells.has(key)) cells.set(key, { row, column, value: 0, count: 0 });
    const cell = cells.get(key);
    cell.value += trade.realizedPnl;
    cell.count += 1;
  }
  return Array.from(cells.values());
}

/**
 * Profit heatmap: total realized PnL by (day-of-week, hour-of-day),
 * winning trades only.
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {import('./types.js').HeatmapCell[]}
 */
export function generateProfitHeatmap(trades) {
  return buildGrid(trades.filter((t) => t.realizedPnl > 0), (t) => dayOfWeek(t.closedAt), (t) => hourOfDay(t.closedAt));
}

/**
 * Loss heatmap: total realized loss (as a positive magnitude) by
 * (day-of-week, hour-of-day), losing trades only.
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {import('./types.js').HeatmapCell[]}
 */
export function generateLossHeatmap(trades) {
  const losses = trades.filter((t) => t.realizedPnl < 0).map((t) => ({ ...t, realizedPnl: Math.abs(t.realizedPnl) }));
  return buildGrid(losses, (t) => dayOfWeek(t.closedAt), (t) => hourOfDay(t.closedAt));
}

/**
 * Trading-time heatmap: trade COUNT (not PnL) by (day-of-week, hour-of-day).
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {import('./types.js').HeatmapCell[]}
 */
export function generateTradingTimeHeatmap(trades) {
  const grid = buildGrid(trades, (t) => dayOfWeek(t.closedAt), (t) => hourOfDay(t.closedAt));
  return grid.map((cell) => ({ ...cell, value: cell.count }));
}

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {{hour: number, netPnl: number, tradeCount: number, winRate: number}[]}
 */
export function generateHourlyPerformance(trades) {
  /** @type {Map<number, import('./types.js').TradeRecord[]>} */
  const byHour = new Map();
  for (const trade of trades) {
    const h = hourOfDay(trade.closedAt);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(trade);
  }
  return Array.from({ length: 24 }, (_, h) => {
    const hourTrades = byHour.get(h) ?? [];
    return {
      hour: h,
      netPnl: hourTrades.reduce((a, t) => a + t.realizedPnl, 0),
      tradeCount: hourTrades.length,
      winRate: hourTrades.length === 0 ? 0 : hourTrades.filter((t) => t.realizedPnl > 0).length / hourTrades.length,
    };
  });
}

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {{date: string, netPnl: number, tradeCount: number, winRate: number}[]} Sorted chronologically.
 */
export function generateDailyPerformance(trades) {
  /** @type {Map<string, import('./types.js').TradeRecord[]>} */
  const byDay = new Map();
  for (const trade of trades) {
    const d = dayKey(trade.closedAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(trade);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, dayTrades]) => ({
      date,
      netPnl: dayTrades.reduce((a, t) => a + t.realizedPnl, 0),
      tradeCount: dayTrades.length,
      winRate: dayTrades.filter((t) => t.realizedPnl > 0).length / dayTrades.length,
    }));
}

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @returns {{month: string, netPnl: number, tradeCount: number, winRate: number}[]} Sorted chronologically.
 */
export function generateMonthlyPerformance(trades) {
  /** @type {Map<string, import('./types.js').TradeRecord[]>} */
  const byMonth = new Map();
  for (const trade of trades) {
    const m = monthKey(trade.closedAt);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(trade);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, monthTrades]) => ({
      month,
      netPnl: monthTrades.reduce((a, t) => a + t.realizedPnl, 0),
      tradeCount: monthTrades.length,
      winRate: monthTrades.filter((t) => t.realizedPnl > 0).length / monthTrades.length,
    }));
}

export default {
  generateProfitHeatmap, generateLossHeatmap, generateTradingTimeHeatmap,
  generateHourlyPerformance, generateDailyPerformance, generateMonthlyPerformance,
};
