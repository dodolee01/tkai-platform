/**
 * @file The learning engine orchestrator. Receives completed trades,
 * persists them, and produces the full learning output (weights,
 * confidence model, performance breakdowns, recommendations) on
 * demand. This is the module's primary integration point.
 * @module learning-engine/LearningEngine
 */

import { createConfig } from './Config.js';
import { TradeStore } from './TradeStore.js';
import { computePerformanceStats } from './PerformanceMetrics.js';
import { computeRawIndicatorStats, buildIndicatorPerformance } from './IndicatorStatistics.js';
import { buildStrategyKeyFn, computeStrategyPerformance } from './StrategyStatistics.js';
import { computeMarketStatePerformance } from './MarketStateStatistics.js';
import { computeConfidenceModel, applyCalibration } from './ConfidenceOptimizer.js';
import { optimizeWeights } from './WeightOptimizer.js';
import { detectOverfitting } from './OverfittingDetector.js';
import { generateRecommendations } from './RecommendationEngine.js';

/**
 * The institutional learning engine. Stateful (trade history, current
 * indicator weights) — updated via {@link LearningEngine#recordTrade}
 * and queried via {@link LearningEngine#getLearningOutput}.
 */
export class LearningEngine {
  /**
   * @param {Object} [options]
   * @param {object} [options.configOverrides] - Deep-merged onto the defaults; see Config.js.
   * @param {import('./Persistence.js').PersistenceAdapter} [options.persistenceAdapter] - Defaults to an in-memory adapter; pass a {@link PocketBasePersistenceAdapter} for production.
   * @param {(trade: import('./types.js').CompletedTrade) => string} [options.strategyKeyFn] - Defaults to `decision:timeframe`; see StrategyStatistics.js.
   * @param {object} [options.logger]
   */
  constructor({ configOverrides = {}, persistenceAdapter, strategyKeyFn, logger = null } = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._logger = logger;
    /** @private */
    this._strategyKeyFn = strategyKeyFn ?? buildStrategyKeyFn(this.config.strategy.defaultKeyFields);

    /** @type {TradeStore} */
    this.tradeStore = new TradeStore({ persistenceAdapter, logger });

    /** @private @type {Object.<string, number>} */
    this._weights = {};
    /** @private */
    this._lastOutput = null;
  }

  /**
   * Load prior trade history from persistence. Call once at startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.tradeStore.hydrate();
    this._recompute();
  }

  /**
   * Record a newly completed trade: persists it (append-only — the
   * trade itself is never modified afterward) and refreshes every
   * derived statistic.
   * @param {import('./types.js').CompletedTrade} trade
   * @returns {Promise<import('./types.js').LearningOutput>} The freshly recomputed learning output.
   */
  async recordTrade(trade) {
    await this.tradeStore.recordTrade(trade);
    this._recompute();
    return this.getLearningOutput();
  }

  /**
   * Recompute every statistic and cache the resulting learning output.
   * Synchronous — operates entirely over the in-memory trade cache.
   * @returns {void}
   * @private
   */
  _recompute() {
    const trades = this.tradeStore.getAllTrades();

    const rawIndicatorStats = computeRawIndicatorStats(trades);
    const indicatorPerformancePreOptimization = buildIndicatorPerformance(
      rawIndicatorStats,
      this._weights,
      this.config.weightOptimizer.baselineWeight
    );

    const { updatedWeights, adjustments } = optimizeWeights(
      indicatorPerformancePreOptimization,
      this._weights,
      this.config.weightOptimizer
    );
    this._weights = updatedWeights;

    const indicatorPerformance = buildIndicatorPerformance(
      rawIndicatorStats,
      this._weights,
      this.config.weightOptimizer.baselineWeight
    );

    const strategyPerformance = computeStrategyPerformance(trades, this._strategyKeyFn, this.config.performance);
    const marketStatePerformance = computeMarketStatePerformance(trades, this.config.performance);
    const confidenceModel = computeConfidenceModel(trades, this.config.confidenceOptimizer);

    const overfittingReport = detectOverfitting(
      {
        trades,
        indicatorPerformance,
        strategyPerformance,
        weightAdjustments: adjustments,
        confidenceModel,
      },
      this.config
    );

    const recommendations = generateRecommendations(
      { indicatorPerformance, strategyPerformance, marketStatePerformance, confidenceModel, overfittingReport },
      this.config
    );

    const overallStats = computePerformanceStats(trades, this.config.performance);
    const learningScore = this._computeLearningScore({
      trades,
      overallStats,
      confidenceModel,
      overfittingReport,
    });

    this._lastOutput = {
      updatedWeights: this._weights,
      updatedConfidenceModel: confidenceModel,
      indicatorPerformance,
      strategyPerformance,
      recommendations,
      learningScore,
      confidenceCalibration: confidenceModel.buckets,
      optimizationSummary: {
        totalTrades: trades.length,
        indicatorsTracked: indicatorPerformance.length,
        weightsAdjustedThisCycle: adjustments.filter((a) => a.adjusted).length,
        overallStats,
        overfitting: overfittingReport,
        marketStatePerformance,
      },
    };
  }

  /**
   * Composite 0-100 learning-health score: how much the system
   * currently has learned and how trustworthy that learning is.
   * @param {Object} input
   * @returns {number}
   * @private
   */
  _computeLearningScore({ trades, overallStats, confidenceModel, overfittingReport }) {
    const weights = this.config.learningScore.weights;

    const sampleSufficiency = Math.min(100, (trades.length / this.config.overfitting.minReliableSampleSize) * 50);
    const calibrationQuality = Math.max(0, 100 - confidenceModel.meanCalibrationError * 400);
    const overfittingPenalty = overfittingReport.flags.filter((f) => f.detected).length * 20;
    const overfittingScore = Math.max(0, 100 - overfittingPenalty);
    const expectancyHealth = Math.min(100, Math.max(0, 50 + overallStats.expectancy * 1000));

    const score =
      sampleSufficiency * weights.sampleSufficiency +
      calibrationQuality * weights.calibrationQuality +
      overfittingScore * weights.overfittingPenalty +
      expectancyHealth * weights.expectancyHealth;

    return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100;
  }

  /**
   * @returns {import('./types.js').LearningOutput} The most recently computed learning output.
   */
  getLearningOutput() {
    if (this._lastOutput === null) this._recompute();
    return this._lastOutput;
  }

  /**
   * Apply the current confidence calibration model to a raw
   * confidence value (e.g. one the Decision Engine is about to act on).
   * @param {number} rawConfidence
   * @returns {number}
   */
  calibrateConfidence(rawConfidence) {
    const model = this.getLearningOutput().updatedConfidenceModel;
    return applyCalibration(rawConfidence, model);
  }

  /**
   * @param {string} indicator
   * @returns {number} The current optimized weight for an indicator (baseline if never observed).
   */
  getIndicatorWeight(indicator) {
    return this._weights[indicator] ?? this.config.weightOptimizer.baselineWeight;
  }
}

export default LearningEngine;
