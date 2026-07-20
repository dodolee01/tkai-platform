/**
 * @file Public barrel export for the portfolio-engine module.
 * @module portfolio-engine
 */

export { PortfolioEngine } from './PortfolioEngine.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { PortfolioManager } from './PortfolioManager.js';
export { AccountManager } from './AccountManager.js';
export { BalanceManager } from './BalanceManager.js';
export { computeEquity, EquityCalculator } from './EquityCalculator.js';
export { ExposureCalculator } from './ExposureCalculator.js';
export { AssetAllocation } from './AssetAllocation.js';
export { CapitalManager } from './CapitalManager.js';
export { computeCagr, computePerformanceReport } from './PerformanceTracker.js';
export { createSnapshot, SnapshotScheduler } from './PortfolioSnapshot.js';
export { PortfolioRepository, InMemoryPortfolioRepository } from './PortfolioRepository.js';
export { PortfolioEventPublisher, PortfolioEventNames } from './PortfolioEvents.js';

export { PortfolioEngine as default } from './PortfolioEngine.js';
