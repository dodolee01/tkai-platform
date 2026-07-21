/**
 * @file Aggregates a compact, dashboard-ready snapshot from the
 * individually-computed analytics reports — the "headline numbers"
 * view a UI would render on a single screen.
 * @module analytics-engine/DashboardData
 */

/**
 * @typedef {Object} DashboardSnapshot
 * @property {number} generatedAt
 * @property {object} headline - Top-line KPIs.
 * @property {object} trade
 * @property {object} performance
 * @property {object} risk
 * @property {object} portfolio
 * @property {object[]} topStrategies - Top 5 by rank score.
 * @property {object[]} recentDailyPerformance - Last 7 entries.
 */

/**
 * @param {Object} reports
 * @param {import('./TradeAnalytics.js').TradeAnalyticsReport} reports.trade
 * @param {import('./ProfitAnalytics.js').ProfitAnalyticsReport} reports.profit
 * @param {import('./PerformanceAnalytics.js').PerformanceAnalyticsReport} reports.performance
 * @param {import('./RiskAnalytics.js').RiskAnalyticsReport} reports.risk
 * @param {import('./PortfolioAnalytics.js').PortfolioAnalyticsReport} reports.portfolio
 * @param {import('./StrategyAnalytics.js').StrategyReport[]} [reports.strategies=[]]
 * @param {{date: string, netPnl: number, tradeCount: number, winRate: number}[]} [reports.dailyPerformance=[]]
 * @returns {DashboardSnapshot}
 */
export function buildDashboardSnapshot({ trade, profit, performance, risk, portfolio, strategies = [], dailyPerformance = [] }) {
  return {
    generatedAt: Date.now(),
    headline: {
      netProfit: profit.netProfit,
      winRate: trade.winRate,
      totalTrades: trade.totalTrades,
      roi: performance.roi,
      sharpeRatio: performance.sharpeRatio,
      currentDrawdownPct: risk.currentDrawdownPct,
      portfolioRiskScore: risk.portfolioRiskScore,
    },
    trade,
    performance,
    risk,
    portfolio,
    topStrategies: strategies.filter((s) => s.rankScore !== null).slice(0, 5),
    recentDailyPerformance: dailyPerformance.slice(-7),
  };
}

export default { buildDashboardSnapshot };
