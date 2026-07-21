/**
 * @file Per-strategy evaluation: win rate, profit/loss, max drawdown,
 * Sharpe, execution quality, signal accuracy, average holding time,
 * and composite ranking across strategies.
 * @module analytics-engine/StrategyAnalytics
 */

import { MetricsEngine } from './MetricsEngine.js';
import { computeSharpeRatio } from './PerformanceAnalytics.js';
import { computeDrawdownAnalytics } from './DrawdownAnalytics.js';
import { mean } from './StatisticsEngine.js';

/**
 * @typedef {Object} StrategyReport
 * @property {string} strategy
 * @property {number} trades
 * @property {number} winRate
 * @property {number} profit
 * @property {number} loss
 * @property {number} maxDrawdownPct
 * @property {number} sharpeRatio
 * @property {number|null} executionQuality - 1 - avg relative slippage vs `expectedEntryPrice`, when trades carry that optional field; null otherwise (never fabricated).
 * @property {number|null} signalAccuracy - Fraction of trades where `predictedDirectionCorrect === 1`; null if no trade in the strategy carries that field.
 * @property {number} averageHoldingTimeMs
 * @property {number} rankScore
 */

/**
 * @param {import('./types.js').TradeRecord[]} trades - Must all share the `strategy` field being evaluated.
 * @param {object} performanceConfig - `config.performance` section.
 * @returns {Omit<StrategyReport, 'strategy'|'rankScore'>}
 * @private
 */
function evaluateStrategyTrades(trades, performanceConfig) {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);

  const chronological = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  let cumulative = 0;
  const equityCurve = chronological.map((t) => {
    cumulative += t.realizedPnl;
    return { equity: cumulative, timestamp: t.closedAt };
  });
  const drawdown = computeDrawdownAnalytics(equityCurve);

  const returns = trades.map((t) => t.realizedPnl);
  const sharpeRatio = computeSharpeRatio(returns, performanceConfig.riskFreeRatePerTrade, performanceConfig.annualizationFactor);

  const withExpectedPrice = trades.filter((t) => t.expectedEntryPrice !== undefined);
  const executionQuality =
    withExpectedPrice.length === 0
      ? null
      : 1 - mean(withExpectedPrice.map((t) => Math.abs(t.entryPrice - t.expectedEntryPrice) / t.expectedEntryPrice));

  const withPrediction = trades.filter((t) => t.predictedDirectionCorrect !== undefined);
  const signalAccuracy = withPrediction.length === 0 ? null : mean(withPrediction.map((t) => t.predictedDirectionCorrect));

  return {
    trades: engine.totalTrades,
    winRate: engine.winRate,
    profit: engine.grossProfit,
    loss: engine.grossLoss,
    maxDrawdownPct: drawdown.maxDrawdownPct,
    sharpeRatio,
    executionQuality,
    signalAccuracy,
    averageHoldingTimeMs: engine.averageHoldingTimeMs,
  };
}

/**
 * Evaluate every strategy present in `trades` (grouped by
 * `trade.strategy`) and rank them by a composite score.
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {object} config - `config.strategy` and `config.performance` sections.
 * @returns {StrategyReport[]} Sorted by `rankScore` descending.
 */
export function computeStrategyAnalytics(trades, config) {
  /** @type {Map<string, import('./types.js').TradeRecord[]>} */
  const byStrategy = new Map();
  for (const trade of trades) {
    const key = trade.strategy ?? 'unclassified';
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key).push(trade);
  }

  const reports = [];
  for (const [strategy, strategyTrades] of byStrategy) {
    const evaluated = evaluateStrategyTrades(strategyTrades, config.performance);
    reports.push({ strategy, ...evaluated, rankScore: 0 });
  }

  // Normalize each ranking component to [0,1] across strategies before
  // weighting, so metrics on very different scales (Sharpe vs win rate)
  // don't dominate the composite score by magnitude alone.
  const eligible = reports.filter((r) => r.trades >= config.strategy.minTradesForRanking);
  const maxSharpe = Math.max(1e-9, ...eligible.map((r) => Math.max(0, r.sharpeRatio)));
  const maxProfitFactor = Math.max(1e-9, ...eligible.map((r) => (r.loss === 0 ? (r.profit > 0 ? 1 : 0) : r.profit / r.loss)));

  const weights = config.strategy.rankingWeights;
  for (const report of reports) {
    if (report.trades < config.strategy.minTradesForRanking) {
      report.rankScore = null;
      continue;
    }
    const normalizedSharpe = Math.max(0, report.sharpeRatio) / maxSharpe;
    const profitFactor = report.loss === 0 ? (report.profit > 0 ? 1 : 0) : report.profit / report.loss;
    const normalizedProfitFactor = profitFactor / maxProfitFactor;
    report.rankScore = normalizedSharpe * weights.sharpe + normalizedProfitFactor * weights.profitFactor + report.winRate * weights.winRate;
  }

  return reports.sort((a, b) => (b.rankScore ?? -1) - (a.rankScore ?? -1));
}

export default { computeStrategyAnalytics };
