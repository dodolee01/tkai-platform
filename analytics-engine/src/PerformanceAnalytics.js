/**
 * @file Institutional performance metrics: ROI, ROE, Sharpe, Sortino,
 * Calmar, Omega, Recovery Factor, Expectancy, Edge Ratio, Alpha,
 * Beta, Information Ratio, and Treynor Ratio.
 * @module analytics-engine/PerformanceAnalytics
 */

import { mean, stdDev, linearRegression } from './StatisticsEngine.js';
import { MetricsEngine } from './MetricsEngine.js';

/**
 * @param {number[]} returns
 * @param {number} riskFreeRatePerPeriod
 * @param {number} annualizationFactor
 * @returns {number}
 */
export function computeSharpeRatio(returns, riskFreeRatePerPeriod, annualizationFactor) {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - riskFreeRatePerPeriod);
  const sd = stdDev(excess);
  return sd === 0 ? 0 : (mean(excess) / sd) * Math.sqrt(annualizationFactor);
}

/**
 * @param {number[]} returns
 * @param {number} riskFreeRatePerPeriod
 * @param {number} annualizationFactor
 * @returns {number}
 */
export function computeSortinoRatio(returns, riskFreeRatePerPeriod, annualizationFactor) {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - riskFreeRatePerPeriod);
  const downside = excess.filter((r) => r < 0);
  if (downside.length === 0) return excess.some((r) => r > 0) ? Infinity : 0;
  const downsideDeviation = Math.sqrt(downside.reduce((a, r) => a + r ** 2, 0) / excess.length);
  return downsideDeviation === 0 ? 0 : (mean(excess) / downsideDeviation) * Math.sqrt(annualizationFactor);
}

/**
 * @param {number} annualizedReturnPct
 * @param {number} maxDrawdownPct
 * @returns {number}
 */
export function computeCalmarRatio(annualizedReturnPct, maxDrawdownPct) {
  if (maxDrawdownPct === 0) return annualizedReturnPct > 0 ? Infinity : 0;
  return annualizedReturnPct / maxDrawdownPct;
}

/**
 * Omega ratio: probability-weighted ratio of gains to losses relative
 * to a threshold return.
 * @param {number[]} returns
 * @param {number} [threshold=0]
 * @returns {number}
 */
export function computeOmegaRatio(returns, threshold = 0) {
  if (returns.length === 0) return 0;
  const gains = returns.reduce((a, r) => a + Math.max(r - threshold, 0), 0);
  const losses = returns.reduce((a, r) => a + Math.max(threshold - r, 0), 0);
  return losses === 0 ? (gains > 0 ? Infinity : 0) : gains / losses;
}

/**
 * @param {number} netProfit
 * @param {number} maxDrawdownAbs
 * @returns {number}
 */
export function computeRecoveryFactor(netProfit, maxDrawdownAbs) {
  if (maxDrawdownAbs === 0) return netProfit > 0 ? Infinity : 0;
  return netProfit / maxDrawdownAbs;
}

/**
 * Edge ratio (payoff ratio): average win divided by average loss.
 * @param {number} averageWin
 * @param {number} averageLoss
 * @returns {number}
 */
export function computeEdgeRatio(averageWin, averageLoss) {
  return averageLoss === 0 ? (averageWin > 0 ? Infinity : 0) : averageWin / averageLoss;
}

/**
 * Beta: sensitivity of portfolio returns to benchmark returns
 * (regression slope of portfolio-on-benchmark).
 * @param {number[]} portfolioReturns
 * @param {number[]} benchmarkReturns
 * @returns {number}
 */
export function computeBeta(portfolioReturns, benchmarkReturns) {
  return linearRegression(benchmarkReturns, portfolioReturns).slope;
}

/**
 * CAPM alpha: excess return not explained by benchmark exposure (beta).
 * @param {number} portfolioMeanReturn
 * @param {number} benchmarkMeanReturn
 * @param {number} riskFreeRatePerPeriod
 * @param {number} beta
 * @returns {number}
 */
export function computeAlpha(portfolioMeanReturn, benchmarkMeanReturn, riskFreeRatePerPeriod, beta) {
  return portfolioMeanReturn - (riskFreeRatePerPeriod + beta * (benchmarkMeanReturn - riskFreeRatePerPeriod));
}

/**
 * Information ratio: active return over tracking error versus a benchmark.
 * @param {number[]} portfolioReturns
 * @param {number[]} benchmarkReturns
 * @returns {number}
 */
export function computeInformationRatio(portfolioReturns, benchmarkReturns) {
  if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) return 0;
  const activeReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  const trackingError = stdDev(activeReturns);
  return trackingError === 0 ? 0 : mean(activeReturns) / trackingError;
}

/**
 * Treynor ratio: excess return per unit of systematic (beta) risk.
 * @param {number} portfolioMeanReturn
 * @param {number} riskFreeRatePerPeriod
 * @param {number} beta
 * @returns {number}
 */
export function computeTreynorRatio(portfolioMeanReturn, riskFreeRatePerPeriod, beta) {
  return beta === 0 ? 0 : (portfolioMeanReturn - riskFreeRatePerPeriod) / beta;
}

/**
 * @typedef {Object} PerformanceAnalyticsReport
 * @property {number} roi
 * @property {number} roe
 * @property {number} sharpeRatio
 * @property {number} sortinoRatio
 * @property {number} calmarRatio
 * @property {number} omegaRatio
 * @property {number} recoveryFactor
 * @property {number} expectancy
 * @property {number} edgeRatio
 * @property {number|null} alpha - null when no benchmark return series is supplied.
 * @property {number|null} beta
 * @property {number|null} informationRatio
 * @property {number|null} treynorRatio
 */

/**
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {Object} equityContext
 * @param {number} equityContext.startEquity
 * @param {number} equityContext.currentEquity
 * @param {number} equityContext.averageEquity
 * @param {number} equityContext.maxDrawdownPct
 * @param {number} equityContext.maxDrawdownAbs
 * @param {number} equityContext.annualizedReturnPct
 * @param {object} config - `config.performance` section.
 * @param {number[]} [benchmarkReturns] - Per-trade (or per-period) benchmark returns, same length/order as `trades`.
 * @returns {PerformanceAnalyticsReport}
 */
export function computePerformanceAnalytics(trades, equityContext, config, benchmarkReturns) {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);

  const returns = trades.map((t) => t.realizedPnl);
  const riskFree = config.riskFreeRatePerTrade;

  const roi = equityContext.startEquity > 0 ? ((equityContext.currentEquity - equityContext.startEquity) / equityContext.startEquity) * 100 : 0;
  const roe = equityContext.averageEquity > 0 ? (engine.netProfit / equityContext.averageEquity) * 100 : 0;

  let alpha = null;
  let beta = null;
  let informationRatio = null;
  let treynorRatio = null;
  if (benchmarkReturns && benchmarkReturns.length === returns.length && returns.length > 1) {
    beta = computeBeta(returns, benchmarkReturns);
    alpha = computeAlpha(mean(returns), mean(benchmarkReturns), riskFree, beta);
    informationRatio = computeInformationRatio(returns, benchmarkReturns);
    treynorRatio = computeTreynorRatio(mean(returns), riskFree, beta);
  }

  return {
    roi,
    roe,
    sharpeRatio: computeSharpeRatio(returns, riskFree, config.annualizationFactor),
    sortinoRatio: computeSortinoRatio(returns, riskFree, config.annualizationFactor),
    calmarRatio: computeCalmarRatio(equityContext.annualizedReturnPct, equityContext.maxDrawdownPct),
    omegaRatio: computeOmegaRatio(returns, config.omegaThreshold),
    recoveryFactor: computeRecoveryFactor(engine.netProfit, equityContext.maxDrawdownAbs),
    expectancy: engine.expectancy,
    edgeRatio: computeEdgeRatio(engine.averageWin, engine.averageLoss),
    alpha,
    beta,
    informationRatio,
    treynorRatio,
  };
}

export default {
  computeSharpeRatio, computeSortinoRatio, computeCalmarRatio, computeOmegaRatio,
  computeRecoveryFactor, computeEdgeRatio, computeBeta, computeAlpha,
  computeInformationRatio, computeTreynorRatio, computePerformanceAnalytics,
};
