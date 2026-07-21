/**
 * @file Deterministic parameter optimization: given a set of
 * candidate parameter configurations each with their own backtest/
 * live trade results, scores and ranks them by a configurable
 * composite objective. This is a grid-search-style evaluator over
 * caller-supplied candidates — it does not generate new parameter
 * combinations itself, and it is not a machine-learning optimizer;
 * every score is a transparent, reproducible function of the
 * candidate's own realized trades.
 * @module analytics-engine/OptimizationEngine
 */

import { MetricsEngine } from './MetricsEngine.js';
import { computeSharpeRatio } from './PerformanceAnalytics.js';

/**
 * @typedef {Object} OptimizationCandidate
 * @property {object} parameters - The parameter set under evaluation (arbitrary shape, echoed back in results).
 * @property {import('./types.js').TradeRecord[]} trades - The trades produced under this parameter set.
 */

/**
 * @typedef {Object} OptimizationResult
 * @property {object} parameters
 * @property {number} trades
 * @property {number} netProfit
 * @property {number} profitFactor
 * @property {number} winRate
 * @property {number} sharpeRatio
 * @property {number} score
 */

/**
 * Default scoring function: a normalized composite of Sharpe, profit
 * factor, and win rate — the same methodology used by
 * {@link import('./StrategyAnalytics.js')} for strategy ranking, so
 * optimization results and strategy rankings are read the same way.
 * @param {{sharpeRatio: number, profitFactor: number, winRate: number}} metrics
 * @param {{maxSharpe: number, maxProfitFactor: number}} normalizers
 * @param {object} weights
 * @returns {number}
 */
function defaultScoreFn(metrics, normalizers, weights) {
  const normalizedSharpe = Math.max(0, metrics.sharpeRatio) / normalizers.maxSharpe;
  const normalizedProfitFactor = Math.min(metrics.profitFactor, normalizers.maxProfitFactor) / normalizers.maxProfitFactor;
  return normalizedSharpe * weights.sharpe + normalizedProfitFactor * weights.profitFactor + metrics.winRate * weights.winRate;
}

/**
 * Evaluate and rank every candidate parameter set.
 * @param {OptimizationCandidate[]} candidates
 * @param {object} config - `config.performance` and `config.strategy` sections.
 * @param {(metrics: object, normalizers: object, weights: object) => number} [scoreFn] - Custom scoring function; defaults to {@link defaultScoreFn}.
 * @returns {OptimizationResult[]} Sorted by `score` descending.
 */
export function optimizeParameters(candidates, config, scoreFn = defaultScoreFn) {
  const evaluated = candidates.map((candidate) => {
    const engine = new MetricsEngine();
    engine.recordTrades(candidate.trades);
    const returns = candidate.trades.map((t) => t.realizedPnl);
    const sharpeRatio = computeSharpeRatio(returns, config.performance.riskFreeRatePerTrade, config.performance.annualizationFactor);
    return {
      parameters: candidate.parameters,
      trades: engine.totalTrades,
      netProfit: engine.netProfit,
      profitFactor: engine.profitFactor,
      winRate: engine.winRate,
      sharpeRatio,
    };
  });

  const finitePF = evaluated.map((e) => (Number.isFinite(e.profitFactor) ? e.profitFactor : 0));
  const normalizers = {
    maxSharpe: Math.max(1e-9, ...evaluated.map((e) => Math.max(0, e.sharpeRatio))),
    maxProfitFactor: Math.max(1e-9, ...finitePF),
  };

  const weights = config.strategy.rankingWeights;
  const results = evaluated.map((e) => ({ ...e, score: scoreFn(e, normalizers, weights) }));
  return results.sort((a, b) => b.score - a.score);
}

/**
 * @param {OptimizationCandidate[]} candidates
 * @param {object} config
 * @param {(metrics: object, normalizers: object, weights: object) => number} [scoreFn]
 * @returns {OptimizationResult|null}
 */
export function findBestParameters(candidates, config, scoreFn) {
  const results = optimizeParameters(candidates, config, scoreFn);
  return results.length === 0 ? null : results[0];
}

export default { optimizeParameters, findBestParameters };
