/**
 * @file Portfolio-level performance metrics computed from closed
 * trades and an equity curve: net/gross profit, profit factor, win
 * rate, ROI, CAGR, Sharpe/Sortino/Calmar, and recovery factor. Pure
 * functions over plain arrays — no state, no I/O.
 * @module portfolio-engine/PerformanceTracker
 */

/**
 * @param {number[]} values
 * @returns {number}
 * @private
 */
function mean(values) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {number[]} values
 * @returns {number}
 * @private
 */
function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * CAGR from a starting equity, ending equity, and elapsed time.
 * @param {number} startEquity
 * @param {number} endEquity
 * @param {number} elapsedMs
 * @returns {number} Percentage (e.g. 25 = +25% annualized).
 */
export function computeCagr(startEquity, endEquity, elapsedMs) {
  if (startEquity <= 0 || elapsedMs <= 0) return 0;
  const years = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0) return 0;
  const ratio = endEquity / startEquity;
  if (ratio <= 0) return -100;
  return (ratio ** (1 / years) - 1) * 100;
}

/**
 * Compute the full portfolio performance report.
 * @param {import('./types.js').ClosedTrade[]} closedTrades
 * @param {Object} equityContext
 * @param {number} equityContext.startEquity
 * @param {number} equityContext.currentEquity
 * @param {number} equityContext.peakEquity
 * @param {number} equityContext.lowestEquity
 * @param {number} equityContext.elapsedMs
 * @param {object} [config] - `config.performance` section.
 * @returns {import('./types.js').PerformanceReport}
 */
export function computePerformanceReport(closedTrades, equityContext, config = { riskFreeRatePerTrade: 0, annualizationFactor: 252 }) {
  const totalTrades = closedTrades.length;

  const wins = closedTrades.filter((t) => t.realizedPnl > 0);
  const losses = closedTrades.filter((t) => t.realizedPnl < 0);

  const grossProfit = wins.reduce((a, t) => a + t.realizedPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.realizedPnl, 0));
  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  const winRate = totalTrades === 0 ? 0 : wins.length / totalTrades;
  const averageTrade = totalTrades === 0 ? 0 : netProfit / totalTrades;

  const holdingTimes = closedTrades.map((t) => t.closedAt - t.openedAt).filter((t) => Number.isFinite(t) && t >= 0);
  const averageHoldingTimeMs = mean(holdingTimes);

  const { startEquity, currentEquity, peakEquity, lowestEquity, elapsedMs } = equityContext;
  const roi = startEquity > 0 ? ((currentEquity - startEquity) / startEquity) * 100 : 0;
  const cagr = computeCagr(startEquity, currentEquity, elapsedMs);

  const pnlSeries = closedTrades.map((t) => t.realizedPnl);
  const excessReturns = pnlSeries.map((p) => p - config.riskFreeRatePerTrade);
  const sd = stdDev(excessReturns);
  const sharpeRatio = sd === 0 ? 0 : (mean(excessReturns) / sd) * Math.sqrt(config.annualizationFactor);

  const downside = excessReturns.filter((r) => r < 0);
  const downsideDeviation = downside.length === 0 ? 0 : Math.sqrt(downside.reduce((a, r) => a + r ** 2, 0) / excessReturns.length);
  const sortinoRatio =
    downsideDeviation === 0 ? (excessReturns.some((r) => r > 0) ? Infinity : 0) : (mean(excessReturns) / downsideDeviation) * Math.sqrt(config.annualizationFactor);

  const maxDrawdownAbs = peakEquity > 0 ? Math.max(0, peakEquity - lowestEquity) : 0;
  const calmarRatio = maxDrawdownAbs === 0 ? (netProfit > 0 ? Infinity : 0) : (netProfit / maxDrawdownAbs);
  const recoveryFactor = calmarRatio; // same formula at the portfolio level; kept as a distinct named field for report clarity

  return {
    netProfit, grossProfit, grossLoss, profitFactor, winRate, averageTrade, averageHoldingTimeMs,
    roi, cagr, sharpeRatio, sortinoRatio, calmarRatio, recoveryFactor,
  };
}

export default { computeCagr, computePerformanceReport };
