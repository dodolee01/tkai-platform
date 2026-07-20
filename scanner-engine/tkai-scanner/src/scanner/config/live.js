/**
 * @file Live-trading (mainnet, real funds) configuration.
 * Same market-data endpoints as production; kept as a distinct profile
 * so deployment tooling can apply stricter health/alerting thresholds
 * when the scanner is feeding a system authorized to place real orders.
 * @module scanner/config/live
 */

import production from './production.js';

export default {
  ...production,
  environment: 'live',
  health: {
    ...production.health,
    // Tighter thresholds: a live-trading feed should fail loudly and early.
    memoryWarnMb: 768,
    memoryCriticalMb: 1536,
    cpuWarnPct: 65,
    cpuCriticalPct: 85,
    reconnectLoopThreshold: 3,
  },
  logging: {
    ...production.logging,
    level: 'warn',
  },
};
