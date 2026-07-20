/**
 * @file Pure performance-metric formulas over a set of trade returns.
 * Every function here takes plain arrays/numbers and returns a
 * number — no state, no I/O, fully unit-testable in isolation.
 * @module learning-engine/PerformanceMetrics
 */

/**
 * @typedef {Object} PerformanceStats
 * @property {number} trades
 * @property {number} winRate
 * @property {number} lossRate
 * @property {number} averageProfit - Mean pnlPercent of winning trades.
 * @property {number} averageLoss - Mean pnlPercent of losing trades, as a positive magnitude.
 * @property {number} expectancy - winRate*averageProfit - lossRate*averageLoss, per-trade expected return.
 * @property {number} profitFactor - Gross profit / gross loss.
 * @property {number} sharpeRatio
 * @property {number} sortinoRatio
 * @property {number} calmarRatio
 * @property {number} maxDrawdown - As a fraction (e.g. 0.15 = 15%).
 * @property {number} recoveryFactor
 */

/**
 * @param {number[]} values
 * @returns {number}
 * @private
 */
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {number[]} values
 * @returns {number}
 * @private
 */
function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number} Fraction of trades with positive pnlPercent.
 */
export function winRate(trades) {
  if (trades.length === 0) return 0;
  return trades.filter((t) => t.pnlPercent > 0).length / trades.length;
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number} Fraction of trades with negative pnlPercent.
 */
export function lossRate(trades) {
  if (trades.length === 0) return 0;
  return trades.filter((t) => t.pnlPercent < 0).length / trades.length;
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number} Mean pnlPercent across winning trades only (0 if none).
 */
export function averageProfit(trades) {
  const wins = trades.filter((t) => t.pnlPercent > 0).map((t) => t.pnlPercent);
  return mean(wins);
}

/**
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number} Mean magnitude of pnlPercent across losing trades only (positive number, 0 if none).
 */
export function averageLoss(trades) {
  const losses = trades.filter((t) => t.pnlPercent < 0).map((t) => Math.abs(t.pnlPercent));
  return mean(losses);
}

/**
 * Expected value per trade: winRate * averageProfit - lossRate * averageLoss.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number}
 */
export function expectancy(trades) {
  return winRate(trades) * averageProfit(trades) - lossRate(trades) * averageLoss(trades);
}

/**
 * Gross profit divided by gross loss. Returns `Infinity` if there are
 * wins and zero losses, and `0` if there are no wins.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number}
 */
export function profitFactor(trades) {
  const grossProfit = trades.filter((t) => t.pnlPercent > 0).reduce((a, t) => a + t.pnlPercent, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnlPercent < 0).reduce((a, t) => a + t.pnlPercent, 0));
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/**
 * Sharpe ratio over the trade-return series (not annualized to
 * calendar time — this is a per-trade Sharpe scaled by
 * `sqrt(annualizationFactor)`, a standard approximation when trade
 * frequency, not elapsed calendar time, is the more meaningful unit).
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {number} [riskFreeRatePerTrade=0]
 * @param {number} [annualizationFactor=252]
 * @returns {number}
 */
export function sharpeRatio(trades, riskFreeRatePerTrade = 0, annualizationFactor = 252) {
  const returns = trades.map((t) => t.pnlPercent);
  if (returns.length < 2) return 0;
  const excessReturns = returns.map((r) => r - riskFreeRatePerTrade);
  const sd = stdDev(excessReturns);
  if (sd === 0) return 0;
  return (mean(excessReturns) / sd) * Math.sqrt(annualizationFactor);
}

/**
 * Sortino ratio: like Sharpe, but the denominator only penalizes
 * downside deviation (volatility of negative excess returns).
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {number} [riskFreeRatePerTrade=0]
 * @param {number} [annualizationFactor=252]
 * @returns {number}
 */
export function sortinoRatio(trades, riskFreeRatePerTrade = 0, annualizationFactor = 252) {
  const returns = trades.map((t) => t.pnlPercent);
  if (returns.length < 2) return 0;
  const excessReturns = returns.map((r) => r - riskFreeRatePerTrade);
  const downside = excessReturns.filter((r) => r < 0);
  if (downside.length === 0) return excessReturns.some((r) => r > 0) ? Infinity : 0;
  const downsideDeviation = Math.sqrt(downside.reduce((a, r) => a + r ** 2, 0) / excessReturns.length);
  if (downsideDeviation === 0) return 0;
  return (mean(excessReturns) / downsideDeviation) * Math.sqrt(annualizationFactor);
}

/**
 * Build a cumulative-return equity curve from a sequence of trades
 * (in chronological order), starting at 1.0.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {number[]}
 */
export function buildEquityCurve(trades) {
  let equity = 1;
  const curve = [equity];
  for (const trade of trades) {
    equity *= 1 + trade.pnlPercent;
    curve.push(equity);
  }
  return curve;
}

/**
 * Maximum peak-to-trough drawdown across an equity curve, as a
 * fraction (e.g. 0.15 = 15% drawdown).
 * @param {number[]} equityCurve - As produced by {@link buildEquityCurve}.
 * @returns {number}
 */
export function maxDrawdown(equityCurve) {
  let peak = -Infinity;
  let maxDd = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const dd = (peak - value) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/**
 * Calmar ratio: annualized-style total return divided by max drawdown.
 * Uses total compounded return over the sample (not calendar-annualized,
 * since trade cadence varies) divided by max drawdown.
 * @param {number[]} equityCurve
 * @returns {number}
 */
export function calmarRatio(equityCurve) {
  if (equityCurve.length < 2) return 0;
  const totalReturn = equityCurve[equityCurve.length - 1] / equityCurve[0] - 1;
  const dd = maxDrawdown(equityCurve);
  if (dd === 0) return totalReturn > 0 ? Infinity : 0;
  return totalReturn / dd;
}

/**
 * Recovery factor: total return divided by max drawdown (a
 * profit-vs-pain ratio; distinct from Calmar in that Calmar is
 * conventionally calendar-annualized while this is not).
 * @param {number[]} equityCurve
 * @returns {number}
 */
export function recoveryFactor(equityCurve) {
  return calmarRatio(equityCurve); // same formula at trade-level granularity; kept as a distinct named export for semantic clarity in callers/reports
}

/**
 * Compute the full {@link PerformanceStats} bundle for a set of trades.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @param {object} [config] - `config.performance` section; defaults used if omitted.
 * @returns {PerformanceStats}
 */
export function computePerformanceStats(trades, config = { riskFreeRatePerTrade: 0, annualizationFactor: 252 }) {
  const equityCurve = buildEquityCurve(trades);
  return {
    trades: trades.length,
    winRate: winRate(trades),
    lossRate: lossRate(trades),
    averageProfit: averageProfit(trades),
    averageLoss: averageLoss(trades),
    expectancy: expectancy(trades),
    profitFactor: profitFactor(trades),
    sharpeRatio: sharpeRatio(trades, config.riskFreeRatePerTrade, config.annualizationFactor),
    sortinoRatio: sortinoRatio(trades, config.riskFreeRatePerTrade, config.annualizationFactor),
    calmarRatio: calmarRatio(equityCurve),
    maxDrawdown: maxDrawdown(equityCurve),
    recoveryFactor: recoveryFactor(equityCurve),
  };
}

export default {
  winRate,
  lossRate,
  averageProfit,
  averageLoss,
  expectancy,
  profitFactor,
  sharpeRatio,
  sortinoRatio,
  buildEquityCurve,
  maxDrawdown,
  calmarRatio,
  recoveryFactor,
  computePerformanceStats,
};
