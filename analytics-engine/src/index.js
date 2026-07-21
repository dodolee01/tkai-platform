/**
 * @file Public barrel export for the analytics-engine module.
 * @module analytics-engine
 */

export { AnalyticsEngine } from './AnalyticsEngine.js';
export { AnalyticsManager } from './AnalyticsManager.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { computeTradeAnalytics } from './TradeAnalytics.js';
export { computeProfitAnalytics, computeProfitDistribution } from './ProfitAnalytics.js';
export { computeLossAnalytics, computeRecoveryEpisodes } from './LossAnalytics.js';
export {
  computePerformanceAnalytics, computeSharpeRatio, computeSortinoRatio, computeCalmarRatio,
  computeOmegaRatio, computeRecoveryFactor, computeEdgeRatio, computeBeta, computeAlpha,
  computeInformationRatio, computeTreynorRatio,
} from './PerformanceAnalytics.js';
export { computeRiskAnalytics } from './RiskAnalytics.js';
export { computePortfolioAnalytics, computeConcentrationIndex } from './PortfolioAnalytics.js';
export { computeMarketAnalytics } from './MarketAnalytics.js';
export { computeStrategyAnalytics } from './StrategyAnalytics.js';
export { computeAIAnalytics, computeConfidenceCalibration, computeCalibrationError } from './AIAnalytics.js';
export { computeDrawdownAnalytics } from './DrawdownAnalytics.js';
export { computeCorrelationMatrix, findHighlyCorrelatedPairs, buildSymbolReturnSeries } from './CorrelationEngine.js';
export { compareToBenchmark, compareToAllBenchmarks, computeReturnsFromPrices } from './BenchmarkEngine.js';
export { projectSeries, forecastPerformance, forecastCapital, forecastDrawdown, forecastGrowth, forecastRisk } from './ForecastEngine.js';
export { analyzeTrend, computeSMA, detectCrossover } from './TrendAnalyzer.js';
export {
  generateProfitHeatmap, generateLossHeatmap, generateTradingTimeHeatmap,
  generateHourlyPerformance, generateDailyPerformance, generateMonthlyPerformance,
} from './HeatmapGenerator.js';
export { buildDashboardSnapshot } from './DashboardData.js';
export { exportToCSV, exportToJSON, exportToExcel, exportToPDFReadyHTML } from './ExportManager.js';
export { AnalyticsRepository, InMemoryAnalyticsRepository } from './AnalyticsRepository.js';
export { AnalyticsEventPublisher, AnalyticsEventNames } from './AnalyticsEvents.js';
export { optimizeParameters, findBestParameters } from './OptimizationEngine.js';
export { resolvePeriodRange, generatePeriodReport, generateCustomReport } from './ReportGenerator.js';
export { MetricsEngine } from './MetricsEngine.js';
export * as StatisticsEngine from './StatisticsEngine.js';

export { AnalyticsEngine as default } from './AnalyticsEngine.js';
