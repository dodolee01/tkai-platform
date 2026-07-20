/**
 * @file Public barrel export for the learning-engine module.
 * @module learning-engine
 */

export { LearningEngine } from './LearningEngine.js';
export { createConfig, DEFAULT_CONFIG, MARKET_REGIMES } from './Config.js';
export { TradeStore } from './TradeStore.js';
export { InMemoryPersistenceAdapter, PocketBasePersistenceAdapter } from './Persistence.js';
export {
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
} from './PerformanceMetrics.js';
export { analyzeByGroup, compareRecentToHistorical } from './PerformanceAnalyzer.js';
export { computeRawIndicatorStats, buildIndicatorPerformance } from './IndicatorStatistics.js';
export { buildStrategyKeyFn, computeStrategyPerformance } from './StrategyStatistics.js';
export { computeMarketStatePerformance, findUnobservedRegimes } from './MarketStateStatistics.js';
export { bucketByConfidence, brierScore, meanCalibrationError } from './Calibration.js';
export { computeConfidenceModel, applyCalibration } from './ConfidenceOptimizer.js';
export { optimizeWeights } from './WeightOptimizer.js';
export { detectOverfitting } from './OverfittingDetector.js';
export { generateRecommendations } from './RecommendationEngine.js';

export { LearningEngine as default } from './LearningEngine.js';
