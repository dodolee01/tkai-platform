/**
 * @file Aggregate performance statistics over a set of closed
 * positions: win/loss rates, profit factor, Sharpe/Sortino,
 * expectancy, and average holding time. Pure functions over plain
 * arrays — no state, no I/O.
 * @module position-engine/PositionStatistics
 */

/**
 * @typedef {Object} ClosedPositionRecord
 * @property {number} realizedPnl
 * @property {number} openedAt
 * @property {number} closedAt
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
 * Compute the full statistics report for a set of closed positions.
 * @param {ClosedPositionRecord[]} positions
 * @param {object} [config] - `config.statistics` section; defaults used if omitted.
 * @returns {import('./types.js').PositionStatisticsReport}
 */
export function computeStatistics(positions, config = { riskFreeRatePerTrade: 0, annualizationFactor: 252 }) {
  const totalTrades = positions.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0, winRate: 0, lossRate: 0, averageWin: 0, averageLoss: 0,
      largestWin: 0, largestLoss: 0, profitFactor: 0, sharpeRatio: 0, sortinoRatio: 0,
      recoveryFactor: 0, expectancy: 0, averageHoldingTimeMs: 0,
    };
  }

  const wins = positions.filter((p) => p.realizedPnl > 0);
  const losses = positions.filter((p) => p.realizedPnl < 0);

  const winRate = wins.length / totalTrades;
  const lossRate = losses.length / totalTrades;
  const averageWin = mean(wins.map((p) => p.realizedPnl));
  const averageLoss = mean(losses.map((p) => Math.abs(p.realizedPnl)));
  const largestWin = wins.length ? Math.max(...wins.map((p) => p.realizedPnl)) : 0;
  const largestLoss = losses.length ? Math.abs(Math.min(...losses.map((p) => p.realizedPnl))) : 0;

  const grossProfit = wins.reduce((a, p) => a + p.realizedPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, p) => a + p.realizedPnl, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;

  const pnlSeries = positions.map((p) => p.realizedPnl);
  const excessReturns = pnlSeries.map((p) => p - config.riskFreeRatePerTrade);
  const sd = stdDev(excessReturns);
  const sharpeRatio = sd === 0 ? 0 : (mean(excessReturns) / sd) * Math.sqrt(config.annualizationFactor);

  const downside = excessReturns.filter((r) => r < 0);
  const downsideDeviation = downside.length === 0 ? 0 : Math.sqrt(downside.reduce((a, r) => a + r ** 2, 0) / excessReturns.length);
  const sortinoRatio =
    downsideDeviation === 0 ? (excessReturns.some((r) => r > 0) ? Infinity : 0) : (mean(excessReturns) / downsideDeviation) * Math.sqrt(config.annualizationFactor);

  let equity = 0;
  let peak = 0;
  let maxDrawdownAbs = 0;
  for (const pnl of pnlSeries) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdownAbs) maxDrawdownAbs = dd;
  }
  const totalPnl = pnlSeries.reduce((a, b) => a + b, 0);
  const recoveryFactor = maxDrawdownAbs === 0 ? (totalPnl > 0 ? Infinity : 0) : totalPnl / maxDrawdownAbs;

  const expectancy = winRate * averageWin - lossRate * averageLoss;

  const holdingTimes = positions.map((p) => p.closedAt - p.openedAt).filter((t) => Number.isFinite(t) && t >= 0);
  const averageHoldingTimeMs = mean(holdingTimes);

  return {
    totalTrades, winRate, lossRate, averageWin, averageLoss, largestWin, largestLoss,
    profitFactor, sharpeRatio, sortinoRatio, recoveryFactor, expectancy, averageHoldingTimeMs,
  };
}

export default { computeStatistics };
