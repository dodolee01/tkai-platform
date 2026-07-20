import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade } from '../src/Validation.js';
import { createConfig } from '../src/Config.js';

const config = createConfig().rejection;
const baseInput = { decision: 'LONG', confidence: 0.8, marketState: 'trending', volatility: 0.01, newsRisk: 'none' };
const goodState = {
  circuitBreakerTripped: false,
  dailyTradeLimitExceeded: false,
  dailyLossLimitExceeded: false,
  drawdownExceeded: false,
  inCooldown: false,
  exposureCheck: { withinLimits: true, violations: [] },
  rrRatio: 3,
};

test('allows a trade meeting every rule', () => {
  const result = validateTrade(baseInput, goodState, config);
  assert.deepEqual(result, { allowed: true, rejectReason: null });
});

test('rejects WAIT and EXIT decisions as non-entries', () => {
  assert.equal(validateTrade({ ...baseInput, decision: 'WAIT' }, goodState, config).rejectReason, 'not_an_entry_decision');
  assert.equal(validateTrade({ ...baseInput, decision: 'EXIT' }, goodState, config).rejectReason, 'not_an_entry_decision');
});

test('circuit breaker takes priority over every other rule', () => {
  const badState = { ...goodState, circuitBreakerTripped: true, drawdownExceeded: true, inCooldown: true };
  assert.equal(validateTrade(baseInput, badState, config).rejectReason, 'circuit_breaker_tripped');
});

test('each individual rejection rule fires with the correct reason', () => {
  assert.equal(validateTrade(baseInput, { ...goodState, inCooldown: true }, config).rejectReason, 'symbol_in_cooldown');
  assert.equal(validateTrade(baseInput, { ...goodState, drawdownExceeded: true }, config).rejectReason, 'drawdown_exceeded');
  assert.equal(validateTrade(baseInput, { ...goodState, dailyLossLimitExceeded: true }, config).rejectReason, 'daily_loss_exceeded');
  assert.equal(validateTrade(baseInput, { ...goodState, dailyTradeLimitExceeded: true }, config).rejectReason, 'daily_trade_limit_exceeded');
  assert.equal(validateTrade({ ...baseInput, marketState: 'illiquid' }, goodState, config).rejectReason, 'market_state_dangerous');
  assert.equal(validateTrade({ ...baseInput, volatility: 0.5 }, goodState, config).rejectReason, 'volatility_too_high');
  assert.equal(validateTrade({ ...baseInput, newsRisk: 'high' }, goodState, config).rejectReason, 'news_risk');
  assert.equal(validateTrade({ ...baseInput, confidence: 0.1 }, goodState, config).rejectReason, 'confidence_too_low');
  assert.equal(validateTrade(baseInput, { ...goodState, rrRatio: 0.1 }, config).rejectReason, 'risk_reward_below_minimum');
});

test('exposure violations surface the specific violation type', () => {
  const state = { ...goodState, exposureCheck: { withinLimits: false, violations: ['correlated_exposure_exceeded'] } };
  assert.equal(validateTrade(baseInput, state, config).rejectReason, 'correlated_exposure_exceeded');
});
