/**
 * @file Generic, reusable incremental metric aggregation over trade
 * streams: win/loss counting, PnL accumulation, streak tracking — the
 * shared incremental engine that TradeAnalytics/ProfitAnalytics/
 * LossAnalytics build their O(1)-per-trade update paths on.
 * @module analytics-engine/MetricsEngine
 */

import { RunningStats } from './StatisticsEngine.js';

/**
 * Accumulates trade-level metrics incrementally — each
 * {@link MetricsEngine#recordTrade} call is O(1), so processing
 * millions of historical trades never requires holding them all in
 * memory simultaneously (a caller can stream trades via
 * {@link import('./AnalyticsRepository.js').AnalyticsRepository#streamTrades}
 * and feed each one through this engine).
 */
export class MetricsEngine {
  constructor() {
    /** @private */ this._totalTrades = 0;
    /** @private */ this._winCount = 0;
    /** @private */ this._lossCount = 0;
    /** @private @type {RunningStats} */ this._winStats = new RunningStats();
    /** @private @type {RunningStats} */ this._lossStats = new RunningStats(); // stores loss magnitudes (positive numbers)
    /** @private @type {RunningStats} */ this._pnlStats = new RunningStats();
    /** @private @type {RunningStats} */ this._holdingTimeStats = new RunningStats();
    /** @private */ this._currentWinStreak = 0;
    /** @private */ this._currentLossStreak = 0;
    /** @private */ this._maxWinStreak = 0;
    /** @private */ this._maxLossStreak = 0;
    /** @private */ this._grossProfit = 0;
    /** @private */ this._grossLoss = 0;
    /** @private */ this._totalFees = 0;
  }

  /**
   * @param {import('./types.js').TradeRecord} trade
   * @returns {void}
   */
  recordTrade(trade) {
    this._totalTrades += 1;
    this._pnlStats.push(trade.realizedPnl);
    this._totalFees += trade.fees ?? 0;

    const holdingTime = trade.closedAt - trade.openedAt;
    if (Number.isFinite(holdingTime) && holdingTime >= 0) this._holdingTimeStats.push(holdingTime);

    if (trade.realizedPnl > 0) {
      this._winCount += 1;
      this._winStats.push(trade.realizedPnl);
      this._grossProfit += trade.realizedPnl;
      this._currentWinStreak += 1;
      this._currentLossStreak = 0;
      if (this._currentWinStreak > this._maxWinStreak) this._maxWinStreak = this._currentWinStreak;
    } else if (trade.realizedPnl < 0) {
      this._lossCount += 1;
      this._lossStats.push(Math.abs(trade.realizedPnl));
      this._grossLoss += Math.abs(trade.realizedPnl);
      this._currentLossStreak += 1;
      this._currentWinStreak = 0;
      if (this._currentLossStreak > this._maxLossStreak) this._maxLossStreak = this._currentLossStreak;
    } else {
      this._currentWinStreak = 0;
      this._currentLossStreak = 0;
    }
  }

  /**
   * @param {import('./types.js').TradeRecord[]} trades
   * @returns {void}
   */
  recordTrades(trades) {
    for (const trade of trades) this.recordTrade(trade);
  }

  /** @returns {number} */
  get totalTrades() { return this._totalTrades; }
  /** @returns {number} */
  get winCount() { return this._winCount; }
  /** @returns {number} */
  get lossCount() { return this._lossCount; }
  /** @returns {number} */
  get winRate() { return this._totalTrades === 0 ? 0 : this._winCount / this._totalTrades; }
  /** @returns {number} */
  get lossRate() { return this._totalTrades === 0 ? 0 : this._lossCount / this._totalTrades; }
  /** @returns {number} */
  get averageWin() { return this._winStats.mean; }
  /** @returns {number} */
  get averageLoss() { return this._lossStats.mean; }
  /** @returns {number} */
  get largestWin() { return this._winStats.count === 0 ? 0 : this._winStats.max; }
  /** @returns {number} */
  get largestLoss() { return this._lossStats.count === 0 ? 0 : this._lossStats.max; }
  /** @returns {number} */
  get averageHoldingTimeMs() { return this._holdingTimeStats.mean; }
  /** @returns {number} */
  get netProfit() { return this._grossProfit - this._grossLoss; }
  /** @returns {number} */
  get grossProfit() { return this._grossProfit; }
  /** @returns {number} */
  get grossLoss() { return this._grossLoss; }
  /** @returns {number} */
  get profitFactor() { return this._grossLoss === 0 ? (this._grossProfit > 0 ? Infinity : 0) : this._grossProfit / this._grossLoss; }
  /** @returns {number} */
  get totalFees() { return this._totalFees; }
  /** @returns {number} */
  get maxConsecutiveWins() { return this._maxWinStreak; }
  /** @returns {number} */
  get maxConsecutiveLosses() { return this._maxLossStreak; }
  /** @returns {number} */
  get currentStreak() { return this._currentWinStreak > 0 ? this._currentWinStreak : -this._currentLossStreak; }
  /** @returns {number} Expectancy: winRate*avgWin - lossRate*avgLoss. */
  get expectancy() { return this.winRate * this.averageWin - this.lossRate * this.averageLoss; }
  /** @returns {RunningStats} */
  get pnlStats() { return this._pnlStats; }
}

export default MetricsEngine;
