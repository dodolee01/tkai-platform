/**
 * @file Generates period reports (daily/weekly/monthly/quarterly/
 * yearly/custom), bundling trade, profit, loss, performance, and
 * risk analytics for the trades that fall within the period.
 * @module analytics-engine/ReportGenerator
 */

import { computeTradeAnalytics } from './TradeAnalytics.js';
import { computeProfitAnalytics } from './ProfitAnalytics.js';
import { computeLossAnalytics } from './LossAnalytics.js';
import { computePerformanceAnalytics } from './PerformanceAnalytics.js';
import { computeDrawdownAnalytics } from './DrawdownAnalytics.js';

/**
 * @param {'daily'|'weekly'|'monthly'|'quarterly'|'yearly'} periodType
 * @param {number} referenceTimestamp - Any timestamp within the desired period.
 * @returns {{since: number, until: number}}
 */
export function resolvePeriodRange(periodType, referenceTimestamp) {
  const date = new Date(referenceTimestamp);
  let start;
  let end;

  switch (periodType) {
    case 'daily':
      start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      end = start + 24 * 60 * 60 * 1000;
      break;
    case 'weekly': {
      const dayOfWeek = (date.getUTCDay() + 6) % 7; // Monday = 0
      start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - dayOfWeek);
      end = start + 7 * 24 * 60 * 60 * 1000;
      break;
    }
    case 'monthly':
      start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
      end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
      break;
    case 'quarterly': {
      const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
      start = Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1);
      end = Date.UTC(date.getUTCFullYear(), quarterStartMonth + 3, 1);
      break;
    }
    case 'yearly':
      start = Date.UTC(date.getUTCFullYear(), 0, 1);
      end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
      break;
    default:
      throw new Error(`ReportGenerator: unknown periodType "${periodType}"`);
  }

  return { since: start, until: end - 1 };
}

/**
 * @typedef {Object} Report
 * @property {string} period - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'.
 * @property {number} since
 * @property {number} until
 * @property {number} generatedAt
 * @property {import('./TradeAnalytics.js').TradeAnalyticsReport} trade
 * @property {import('./ProfitAnalytics.js').ProfitAnalyticsReport} profit
 * @property {import('./LossAnalytics.js').LossAnalyticsReport} loss
 * @property {import('./PerformanceAnalytics.js').PerformanceAnalyticsReport} performance
 * @property {import('./DrawdownAnalytics.js').DrawdownAnalyticsReport} drawdown
 */

/**
 * Generate a bundled analytics report for a standard period type.
 * @param {import('./types.js').TradeRecord[]} allTrades
 * @param {'daily'|'weekly'|'monthly'|'quarterly'|'yearly'} periodType
 * @param {number} referenceTimestamp
 * @param {object} config - Full analytics-engine config.
 * @param {import('./types.js').EquityPoint[]} [equityCurve=[]] - Equity points within the period, for drawdown.
 * @returns {Report}
 */
export function generatePeriodReport(allTrades, periodType, referenceTimestamp, config, equityCurve = []) {
  const { since, until } = resolvePeriodRange(periodType, referenceTimestamp);
  return generateCustomReport(allTrades, since, until, config, equityCurve);
}

/**
 * Generate a report for an arbitrary custom date range.
 * @param {import('./types.js').TradeRecord[]} allTrades
 * @param {number} since
 * @param {number} until
 * @param {object} config
 * @param {import('./types.js').EquityPoint[]} [equityCurve=[]]
 * @returns {Report}
 */
export function generateCustomReport(allTrades, since, until, config, equityCurve = []) {
  const periodTrades = allTrades.filter((t) => t.closedAt >= since && t.closedAt <= until);
  const drawdown = computeDrawdownAnalytics(equityCurve);

  const startEquity = equityCurve.length > 0 ? equityCurve[0].equity : 0;
  const currentEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0;
  const netProfit = periodTrades.reduce((a, t) => a + t.realizedPnl, 0);
  const maxDrawdownAbs = equityCurve.length === 0 ? 0 : (drawdown.maxDrawdownPct / 100) * Math.max(...equityCurve.map((p) => p.equity), 1);

  return {
    since,
    until,
    generatedAt: Date.now(),
    trade: computeTradeAnalytics(periodTrades),
    profit: computeProfitAnalytics(periodTrades),
    loss: computeLossAnalytics(periodTrades),
    performance: computePerformanceAnalytics(
      periodTrades,
      { startEquity, currentEquity, averageEquity: (startEquity + currentEquity) / 2, maxDrawdownPct: drawdown.maxDrawdownPct, maxDrawdownAbs, annualizedReturnPct: startEquity > 0 ? (netProfit / startEquity) * 100 : 0 },
      config.performance
    ),
    drawdown,
  };
}

export default { resolvePeriodRange, generatePeriodReport, generateCustomReport };
