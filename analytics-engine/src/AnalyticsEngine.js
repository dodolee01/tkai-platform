/**
 * @file The analytics engine orchestrator — wires the manager, every
 * specialized analytics module, forecasting, heatmaps, benchmarking,
 * reporting, and export together into a single public API. This is
 * the module's sole integration point for every other engine
 * (Modules 1–9) and for direct application use.
 * @module analytics-engine/AnalyticsEngine
 */

import { createConfig } from './Config.js';
import { AnalyticsManager } from './AnalyticsManager.js';
import { InMemoryAnalyticsRepository } from './AnalyticsRepository.js';
import { AnalyticsEventPublisher, AnalyticsEventNames } from './AnalyticsEvents.js';
import { computeRiskAnalytics } from './RiskAnalytics.js';
import { computePortfolioAnalytics } from './PortfolioAnalytics.js';
import { computeMarketAnalytics } from './MarketAnalytics.js';
import { computeStrategyAnalytics } from './StrategyAnalytics.js';
import { computeCorrelationMatrix, buildSymbolReturnSeries } from './CorrelationEngine.js';
import { compareToAllBenchmarks } from './BenchmarkEngine.js';
import { forecastPerformance, forecastDrawdown, forecastGrowth, forecastRisk } from './ForecastEngine.js';
import * as Heatmap from './HeatmapGenerator.js';
import { optimizeParameters } from './OptimizationEngine.js';
import { generatePeriodReport, generateCustomReport } from './ReportGenerator.js';
import { buildDashboardSnapshot } from './DashboardData.js';
import { exportToCSV, exportToJSON, exportToExcel, exportToPDFReadyHTML } from './ExportManager.js';

export class AnalyticsEngine {
  /**
   * @param {Object} [deps]
   * @param {import('./AnalyticsRepository.js').AnalyticsRepository} [deps.repository] - Defaults to an in-memory repository.
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ repository = new InMemoryAnalyticsRepository(), logger = null } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._logger = logger;
    /** @private */ this._repository = repository;

    /** @type {AnalyticsEventPublisher} */
    this.eventPublisher = new AnalyticsEventPublisher();
    /** @type {AnalyticsManager} */
    this.manager = new AnalyticsManager({ repository, logger }, this.config);

    /** @private @type {object|null} */
    this._lastForecastSnapshot = null;
    /** @private @type {object|null} */
    this._lastHeatmapSnapshot = null;
    /** @private */ this._unsubscribers = [];
  }

  /**
   * Load prior trade history from the repository. Call once at startup.
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.manager.initialize();
  }

  /**
   * Record a newly-completed trade and recompute/publish analytics.
   * @param {import('./types.js').TradeRecord} trade
   * @returns {Promise<void>}
   */
  async recordTrade(trade) {
    await this.manager.recordTrade(trade);
    const analytics = this.manager.computeFullAnalytics();
    this.eventPublisher.safeEmit(AnalyticsEventNames.ANALYTICS_UPDATED, analytics);
    this.eventPublisher.safeEmit(AnalyticsEventNames.PERFORMANCE_UPDATED, analytics.performance);

    const { rankings, changed } = this.manager.computeStrategyRankings();
    if (changed) this.eventPublisher.safeEmit(AnalyticsEventNames.STRATEGY_RANK_CHANGED, rankings);
  }

  /**
   * Record a new equity observation.
   * @param {number} equity
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordEquity(equity, timestamp = Date.now()) {
    this.manager.recordEquity(equity, timestamp);
  }

  /**
   * Subscribe to an event-emitting engine (any of Modules 1–9's
   * event publishers, duck-typed — only `.on(eventName, handler)` is
   * required) and map its events to analytics inputs.
   * @param {{on: (eventName: string, handler: Function) => void}} emitter
   * @param {Object.<string, (payload: any) => (import('./types.js').TradeRecord|null)>} tradeEventMap - eventName -> a function turning the event payload into a TradeRecord (or null to skip).
   * @returns {void}
   */
  subscribeToEngine(emitter, tradeEventMap) {
    for (const [eventName, mapper] of Object.entries(tradeEventMap)) {
      const handler = (payload) => {
        try {
          const trade = mapper(payload);
          if (trade) this.recordTrade(trade);
        } catch (err) {
          this._logger?.error?.(`Event mapper for "${eventName}" threw`, { error: err.message });
        }
      };
      emitter.on(eventName, handler);
      this._unsubscribers.push(() => emitter.off?.(eventName, handler));
    }
  }

  /**
   * @param {object} [filter]
   * @returns {object} The full bundled analytics (trade/profit/loss/drawdown/performance/ai).
   */
  getAnalytics(filter = {}) {
    return this.manager.computeFullAnalytics(filter);
  }

  /**
   * @param {import('./types.js').PortfolioSnapshot} portfolioSnapshot
   * @param {{distanceToLiquidationPct: number, notionalPct: number}[]} [positionLiquidationDistances=[]]
   * @returns {import('./RiskAnalytics.js').RiskAnalyticsReport}
   */
  getRiskAnalytics(portfolioSnapshot, positionLiquidationDistances = []) {
    return computeRiskAnalytics(this.manager.getEquityCurve(), portfolioSnapshot, positionLiquidationDistances);
  }

  /**
   * @param {import('./types.js').PortfolioSnapshot} portfolioSnapshot
   * @returns {import('./PortfolioAnalytics.js').PortfolioAnalyticsReport}
   */
  getPortfolioAnalytics(portfolioSnapshot) {
    return computePortfolioAnalytics(portfolioSnapshot);
  }

  /**
   * @param {import('./types.js').MarketSnapshot[]} snapshots
   * @returns {import('./MarketAnalytics.js').MarketAnalyticsReport}
   */
  getMarketAnalytics(snapshots) {
    return computeMarketAnalytics(snapshots, this.config.market);
  }

  /**
   * @param {object} [filter]
   * @returns {import('./StrategyAnalytics.js').StrategyReport[]}
   */
  getStrategyAnalytics(filter = {}) {
    return computeStrategyAnalytics(this.manager.getTrades(filter), this.config);
  }

  /**
   * @param {number} [bucketCount=20]
   * @returns {{names: string[], matrix: number[][]}}
   */
  getSymbolCorrelationMatrix(bucketCount = 20) {
    const series = buildSymbolReturnSeries(this.manager.getTrades(), bucketCount);
    return computeCorrelationMatrix(series);
  }

  /**
   * @param {Object.<string, import('./types.js').BenchmarkPoint[]>} benchmarks
   * @returns {import('./BenchmarkEngine.js').BenchmarkComparisonReport[]}
   */
  getBenchmarkComparison(benchmarks) {
    const trades = this.manager.getTrades().sort((a, b) => a.closedAt - b.closedAt);
    const portfolioReturns = trades.map((t) => t.realizedPnl);
    const results = compareToAllBenchmarks(portfolioReturns, benchmarks, this.config.performance.riskFreeRatePerTrade);
    return results;
  }

  /**
   * Compute and publish an updated forecast bundle (performance,
   * drawdown, growth, risk).
   * @param {number[]} [historicalDrawdownPct=[]]
   * @param {number[]} [historicalRiskExposurePct=[]]
   * @returns {object}
   */
  updateForecast(historicalDrawdownPct = [], historicalRiskExposurePct = []) {
    const equityCurve = this.manager.getEquityCurve();
    const snapshot = {
      performance: forecastPerformance(equityCurve, this.config.forecast),
      drawdown: forecastDrawdown(historicalDrawdownPct, this.config.forecast),
      growth: forecastGrowth(equityCurve, this.config.forecast),
      risk: forecastRisk(historicalRiskExposurePct, this.config.forecast),
    };
    this._lastForecastSnapshot = snapshot;
    this.eventPublisher.safeEmit(AnalyticsEventNames.FORECAST_UPDATED, snapshot);
    return snapshot;
  }

  /**
   * Compute and publish an updated heatmap bundle.
   * @param {object} [filter]
   * @returns {object}
   */
  updateHeatmaps(filter = {}) {
    const trades = this.manager.getTrades(filter);
    const snapshot = {
      profit: Heatmap.generateProfitHeatmap(trades),
      loss: Heatmap.generateLossHeatmap(trades),
      tradingTime: Heatmap.generateTradingTimeHeatmap(trades),
      hourly: Heatmap.generateHourlyPerformance(trades),
      daily: Heatmap.generateDailyPerformance(trades),
      monthly: Heatmap.generateMonthlyPerformance(trades),
    };
    this._lastHeatmapSnapshot = snapshot;
    this.eventPublisher.safeEmit(AnalyticsEventNames.HEATMAP_UPDATED, snapshot);
    return snapshot;
  }

  /**
   * @param {import('./OptimizationEngine.js').OptimizationCandidate[]} candidates
   * @returns {import('./OptimizationEngine.js').OptimizationResult[]}
   */
  optimizeStrategyParameters(candidates) {
    return optimizeParameters(candidates, this.config);
  }

  /**
   * Generate and publish a period report.
   * @param {'daily'|'weekly'|'monthly'|'quarterly'|'yearly'} periodType
   * @param {number} [referenceTimestamp=Date.now()]
   * @returns {Promise<import('./ReportGenerator.js').Report>}
   */
  async generateReport(periodType, referenceTimestamp = Date.now()) {
    const report = generatePeriodReport(this.manager.getTrades(), periodType, referenceTimestamp, this.config, this.manager.getEquityCurve());
    const stored = await this._repository.saveReport({ ...report, period: periodType });
    this.eventPublisher.safeEmit(AnalyticsEventNames.REPORT_GENERATED, stored);
    return stored;
  }

  /**
   * Generate and publish a custom-range report.
   * @param {number} since
   * @param {number} until
   * @returns {Promise<import('./ReportGenerator.js').Report>}
   */
  async generateCustomReport(since, until) {
    const report = generateCustomReport(this.manager.getTrades(), since, until, this.config, this.manager.getEquityCurve());
    const stored = await this._repository.saveReport({ ...report, period: 'custom' });
    this.eventPublisher.safeEmit(AnalyticsEventNames.REPORT_GENERATED, stored);
    return stored;
  }

  /**
   * @returns {object} A compact, dashboard-ready snapshot of key metrics.
   */
  getDashboardSnapshot() {
    const analytics = this.manager.computeFullAnalytics();
    const { rankings } = this.manager.computeStrategyRankings();
    return buildDashboardSnapshot({
      trade: analytics.trade,
      profit: analytics.profit,
      performance: analytics.performance,
      risk: { currentDrawdownPct: analytics.drawdown.currentDrawdownPct, portfolioRiskScore: 0 },
      portfolio: {},
      strategies: rankings,
      dailyPerformance: Heatmap.generateDailyPerformance(this.manager.getTrades()),
    });
  }

  /**
   * @param {'json'|'csv'|'excel'|'pdf'} format
   * @param {object|object[]} data
   * @param {string} [title='Analytics Export']
   * @returns {string}
   */
  export(format, data, title = 'Analytics Export') {
    switch (format) {
      case 'json':
        return exportToJSON(data);
      case 'csv':
        return exportToCSV(Array.isArray(data) ? data : [data], this.config.export.csvDelimiter);
      case 'excel':
        return exportToExcel(Array.isArray(data) ? data : [data]);
      case 'pdf':
        return exportToPDFReadyHTML(title, Array.isArray(data) ? { data } : data);
      default:
        throw new Error(`AnalyticsEngine.export: unknown format "${format}"`);
    }
  }

  /**
   * Unsubscribe from every engine subscribed via
   * {@link AnalyticsEngine#subscribeToEngine}.
   * @returns {void}
   */
  shutdown() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
  }
}

export default AnalyticsEngine;
