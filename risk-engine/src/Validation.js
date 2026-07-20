/**
 * @file Pure rejection-rule evaluation. Given a decision input and the
 * current risk state (from the other managers), determines whether a
 * trade is allowed and, if not, why.
 * @module risk-engine/Validation
 */

import { getNewsRiskLevels } from './Config.js';

const NEWS_RISK_LEVELS = getNewsRiskLevels();

/**
 * @param {string} level
 * @returns {number}
 * @private
 */
function newsRiskIndex(level) {
  const idx = NEWS_RISK_LEVELS.indexOf(level);
  return idx === -1 ? 0 : idx;
}

/**
 * @typedef {Object} RiskState
 * @property {boolean} circuitBreakerTripped
 * @property {boolean} dailyTradeLimitExceeded
 * @property {boolean} dailyLossLimitExceeded
 * @property {boolean} drawdownExceeded
 * @property {boolean} inCooldown
 * @property {{withinLimits:boolean, violations:string[]}} exposureCheck
 * @property {number} rrRatio
 */

/**
 * Evaluate every rejection rule against the current decision and risk
 * state. Returns the FIRST applicable rejection reason (rules are
 * checked in a fixed, documented priority order — circuit-breaker and
 * hard-safety conditions before soft/economic ones) or `allowed: true`
 * if none apply.
 * @param {import('./types.js').DecisionInput} input
 * @param {RiskState} riskState
 * @param {object} config - `config.rejection` section.
 * @returns {{allowed:boolean, rejectReason:string|null}}
 */
export function validateTrade(input, riskState, config) {
  if (input.decision === 'WAIT' || input.decision === 'EXIT') {
    return { allowed: false, rejectReason: 'not_an_entry_decision' };
  }

  if (riskState.circuitBreakerTripped) {
    return { allowed: false, rejectReason: 'circuit_breaker_tripped' };
  }

  if (riskState.inCooldown) {
    return { allowed: false, rejectReason: 'symbol_in_cooldown' };
  }

  if (riskState.drawdownExceeded) {
    return { allowed: false, rejectReason: 'drawdown_exceeded' };
  }

  if (riskState.dailyLossLimitExceeded) {
    return { allowed: false, rejectReason: 'daily_loss_exceeded' };
  }

  if (riskState.dailyTradeLimitExceeded) {
    return { allowed: false, rejectReason: 'daily_trade_limit_exceeded' };
  }

  if (!riskState.exposureCheck.withinLimits) {
    return { allowed: false, rejectReason: riskState.exposureCheck.violations[0] };
  }

  if (config.dangerousMarketStates.includes(input.marketState)) {
    return { allowed: false, rejectReason: 'market_state_dangerous' };
  }

  if (input.volatility > config.maxVolatility) {
    return { allowed: false, rejectReason: 'volatility_too_high' };
  }

  if (newsRiskIndex(input.newsRisk ?? 'none') > newsRiskIndex(config.maxNewsRiskLevel)) {
    return { allowed: false, rejectReason: 'news_risk' };
  }

  if (input.confidence < config.minConfidence) {
    return { allowed: false, rejectReason: 'confidence_too_low' };
  }

  if (riskState.rrRatio < config.minRiskReward) {
    return { allowed: false, rejectReason: 'risk_reward_below_minimum' };
  }

  return { allowed: true, rejectReason: null };
}

export default { validateTrade };
