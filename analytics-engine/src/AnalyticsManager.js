/**
 * @file Mid-level manager: owns the trade history cache (backed by
 * an injected repository), and computes/re-computes the full set of
 * analytics reports whenever new trades arrive, detecting strategy
 * rank changes to drive the `strategyRankChanged` event.
 * @module analytics-engine/AnalyticsManager
 */

import { computeTradeAnalytics } from './TradeAnalytics.js';
import { computeProfitAnalytics } from './ProfitAnalytics.js';
import { computeLossAnalytics } from './LossAnalytics.js';
import { computePerformanceAnalytics } from './PerformanceAnalytics.js';
import { computeDrawdownAnalytics } from './DrawdownAnalytics.js';
import { computeStrategyAnalytics } from './StrategyAnalytics.js';
import { computeAIAnalytics } from './AIAnalytics.js';
import { monthKey } from './StatisticsEngine.js';

export class AnalyticsManager {
  /**
   * @param {Object} deps
   * @param {import('./AnalyticsRepository.js').AnalyticsRepository} deps.repository
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - Full analytics-engine config.
   */
  constructor({ repository, logger = null }, config) {
    /** @private */ this._repository = repository;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
    /** @private @type {import('./types.js').TradeRecord[]} */
    this._trades = [];
    /** @private @type {import('./types.js').EquityPoint[]} */
    this._equityCurve = [];
    /** @private @type {import('./StrategyAnalytics.js').StrategyReport[]} */
    this._lastStrategyRanking = [];
  }

  /**
   * Load prior trade history from the repository. Call once at startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    this._trades = await this._repository.getTrades();
  }

  /**
   * Record a newly-completed trade, persist it, and add it to the
   * in-memory analysis cache.
   * @param {import('./types.js').TradeRecord} trade
   * @returns {Promise<void>}
   */
  async recordTrade(trade) {
    await this._repository.saveTrade(trade);
    this._trades.push(trade);
  }

  /**
   * Record a new equity observation (drives drawdown/performance
   * calculations that depend on the equity curve, not just trades).
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this._equityCurve.push({ equity, timestamp });
  }

  /**
   * @param {object} [filter]
   * @returns {import('./types.js').TradeRecord[]}
   */
  getTrades(filter = {}) {
    let result = this._trades.slice();
    if (filter.userId !== undefined) result = result.filter((t) => t.userId === filter.userId);
    if (filter.symbol !== undefined) result = result.filter((t) => t.symbol === filter.symbol);
    if (filter.strategy !== undefined) result = result.filter((t) => t.strategy === filter.strategy);
    if (filter.since !== undefined) result = result.filter((t) => t.closedAt >= filter.since);
    if (filter.until !== undefined) result = result.filter((t) => t.closedAt <= filter.until);
    return result;
  }

  /**
   * @returns {import('./types.js').EquityPoint[]}
   */
  getEquityCurve() {
    return this._equityCurve.slice();
  }

  /**
   * Compute the full analytics bundle from the current trade/equity cache.
   * @param {object} [filter] - Same shape as {@link AnalyticsManager#getTrades}.
   * @returns {object}
   */
  computeFullAnalytics(filter = {}) {
    const trades = this.getTrades(filter);
    const drawdown = computeDrawdownAnalytics(this._equityCurve);
    const startEquity = this._equityCurve.length > 0 ? this._equityCurve[0].equity : 0;
    const currentEquity = this._equityCurve.length > 0 ? this._equityCurve[this._equityCurve.length - 1].equity : 0;
    const netProfit = trades.reduce((a, t) => a + t.realizedPnl, 0);
    const maxDrawdownAbs = this._equityCurve.length === 0 ? 0 : (drawdown.maxDrawdownPct / 100) * Math.max(...this._equityCurve.map((p) => p.equity), 1);

    return {
      trade: computeTradeAnalytics(trades),
      profit: computeProfitAnalytics(trades),
      loss: computeLossAnalytics(trades),
      drawdown,
      performance: computePerformanceAnalytics(
        trades,
        { startEquity, currentEquity, averageEquity: (startEquity + currentEquity) / 2, maxDrawdownPct: drawdown.maxDrawdownPct, maxDrawdownAbs, annualizedReturnPct: startEquity > 0 ? (netProfit / startEquity) * 100 : 0 },
        this._config.performance
      ),
      ai: computeAIAnalytics(trades, monthKey),
    };
  }

  /**
   * Recompute strategy rankings and report whether the ranking order
   * changed since the last call (drives the `strategyRankChanged` event).
   * @param {object} [filter]
   * @returns {{rankings: import('./StrategyAnalytics.js').StrategyReport[], changed: boolean}}
   */
  computeStrategyRankings(filter = {}) {
    const trades = this.getTrades(filter);
    const rankings = computeStrategyAnalytics(trades, this._config);

    const previousOrder = this._lastStrategyRanking.map((r) => r.strategy);
    const newOrder = rankings.map((r) => r.strategy);
    const changed = previousOrder.length !== newOrder.length || previousOrder.some((s, i) => s !== newOrder[i]);

    this._lastStrategyRanking = rankings;
    return { rankings, changed };
  }
}

export default AnalyticsManager;
