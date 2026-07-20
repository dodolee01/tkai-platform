/**
 * @file Public barrel export for the position-engine module.
 * @module position-engine
 */

export { PositionEngine } from './PositionEngine.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { PositionState, canTransition, assertValidTransition, isTerminal, isLive } from './PositionStateMachine.js';
export { PositionManager } from './PositionManager.js';
export { PositionSynchronizer, diffPosition } from './PositionSynchronizer.js';
export { computeUnrealizedPnl, computeRealizedPnl, computeNetPnl } from './PnLCalculator.js';
export { computeRoi, computeUnleveragedRoi } from './ROIEngine.js';
export { computeFundingPayment, FundingCalculator } from './FundingCalculator.js';
export { computeInitialMargin, computeMaintenanceMargin, computeMarginRatio, isMarginCallLevel } from './MarginCalculator.js';
export { estimateLiquidationPrice, distanceToLiquidationPct, isLiquidated } from './LiquidationCalculator.js';
export { evaluateBreakEven } from './BreakEvenEngine.js';
export { evaluateTrailingStop } from './TrailingStopEngine.js';
export { executePartialClose, executePresetPartialClose, PRESET_FRACTIONS } from './PartialCloseEngine.js';
export { computeStatistics } from './PositionStatistics.js';
export { DrawdownTracker } from './DrawdownTracker.js';
export { ExposureManager } from './ExposureManager.js';
export { EventPublisher, PositionEvents } from './EventPublisher.js';
export { PositionRepository, InMemoryPositionRepository } from './PositionRepository.js';

export { PositionEngine as default } from './PositionEngine.js';
