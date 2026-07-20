/**
 * @file Public barrel export for the execution-engine module.
 * @module execution-engine
 */

export { ExecutionEngine } from './ExecutionEngine.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { ExchangeAdapter } from './ExchangeAdapter.js';
export { BinanceAdapter } from './BinanceAdapter.js';
export { OrderManager } from './OrderManager.js';
export { OrderValidator } from './OrderValidator.js';
export { OrderTracker, OrderStatus } from './OrderTracker.js';
export { PositionManager } from './PositionManager.js';
export { LeverageManager } from './LeverageManager.js';
export { ExecutionQueue } from './ExecutionQueue.js';
export { RetryManager } from './RetryManager.js';
export { DuplicateProtection, computeIdempotencyKey } from './DuplicateProtection.js';
export { RateLimiter } from './RateLimiter.js';
export { KillSwitch } from './KillSwitch.js';
export {
  roundToTickSize,
  roundToStepSize,
  computeNotional,
  meetsMinNotional,
  withinQtyBounds,
  isAlignedToStep,
} from './Precision.js';
export { ErrorType, classifyError } from './ErrorHandler.js';

export { ExecutionEngine as default } from './ExecutionEngine.js';
