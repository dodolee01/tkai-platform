/**
 * @file Public barrel export for the risk-engine module.
 * @module risk-engine
 */

export { RiskEngine } from './RiskEngine.js';
export { createConfig, DEFAULT_CONFIG, getNewsRiskLevels } from './Config.js';
export { computeRawKellyFraction, computeKellyPositionFraction } from './KellyCriterion.js';
export {
  fixedSize,
  percentageOfEquitySize,
  kellySize,
  atrPositionSize,
  volatilityAdjustedSize,
  confidenceAdjustedSize,
  computePositionSize,
} from './PositionSizing.js';
export {
  computeAtrStopLoss,
  stopDistance,
  currentRMultiple,
  applyBreakEven,
  applyTrailingStop,
} from './StopLoss.js';
export { computeTakeProfitTargets, computeBlendedRiskReward, meetsMinimumRiskReward } from './TakeProfit.js';
export { computePortfolioHeat, isHeatWithinLimit } from './PortfolioHeat.js';
export { ExposureManager } from './ExposureManager.js';
export { computeAdjustedLeverage } from './LeverageManager.js';
export { DrawdownManager } from './DrawdownManager.js';
export { CircuitBreaker } from './CircuitBreaker.js';
export { CooldownManager } from './CooldownManager.js';
export { computeRiskScore } from './RiskScore.js';
export { validateTrade } from './Validation.js';

export { RiskEngine as default } from './RiskEngine.js';
