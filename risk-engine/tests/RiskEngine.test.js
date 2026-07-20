import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RiskEngine } from '../src/RiskEngine.js';

function baseDecision(overrides = {}) {
  return {
    symbol: 'BTCUSDT',
    decision: 'LONG',
    confidence: 0.8,
    marketState: 'trending',
    trendStrength: 0.7,
    volatility: 0.015,
    recommendedLeverage: 5,
    recommendedRisk: 0.02,
    bullishSignals: ['a'],
    bearishSignals: [],
    scoreBreakdown: {},
    entryPrice: 65000,
    atr: 500,
    equity: 10000,
    newsRisk: 'none',
    ...overrides,
  };
}

test('evaluate() returns a complete, allowed execution plan for a good setup', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision());

  assert.equal(plan.allowed, true);
  assert.equal(plan.rejectReason, null);
  assert.ok(plan.positionSize > 0);
  assert.ok(plan.leverage > 0 && plan.leverage <= 5);
  assert.ok(plan.stopLoss < 65000);
  assert.equal(plan.takeProfit.length, 3);
  assert.equal(typeof plan.riskScore, 'number');
  assert.equal(typeof plan.portfolioHeat, 'number');
  assert.ok(plan.rrRatio >= 1.5);
});

test('evaluate() rejects and zeroes size for low confidence', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision({ confidence: 0.1 }));
  assert.equal(plan.allowed, false);
  assert.equal(plan.rejectReason, 'confidence_too_low');
  assert.equal(plan.positionSize, 0);
  assert.equal(plan.leverage, 0);
});

test('evaluate() rejects WAIT/EXIT decisions', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision({ decision: 'WAIT' }));
  assert.equal(plan.rejectReason, 'not_an_entry_decision');
});

test('openPosition + recordTradeResult round-trip updates exposure, circuit breaker, and cooldown', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision());
  engine.openPosition({ symbol: 'BTCUSDT', notional: plan.positionSize, side: 'LONG', riskAmount: 20 });
  assert.equal(engine.exposureManager.getOpenPositions().length, 1);

  engine.recordTradeResult({ symbol: 'BTCUSDT', pnl: -50, pnlPct: -0.005, timestamp: Date.now() });
  assert.equal(engine.exposureManager.getOpenPositions().length, 0);
  assert.equal(engine.cooldownManager.isInCooldown('BTCUSDT'), true);

  const nextPlan = engine.evaluate(baseDecision());
  assert.equal(nextPlan.allowed, false);
  assert.equal(nextPlan.rejectReason, 'symbol_in_cooldown');
});

test('a tripped circuit breaker blocks trades on any symbol', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  for (let i = 0; i < engine.config.circuitBreaker.maxConsecutiveLosses; i++) {
    engine.recordTradeResult({ symbol: `X${i}`, pnl: -1, pnlPct: -0.001, timestamp: Date.now() });
  }
  const plan = engine.evaluate(baseDecision({ symbol: 'FRESHUSDT' }));
  assert.equal(plan.rejectReason, 'circuit_breaker_tripped');
});

test('severe drawdown trips equity protection and blocks new trades', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  engine.recordEquity(6000); // 40% drawdown, exceeds default 30% equity protection threshold
  const plan = engine.evaluate(baseDecision());
  assert.equal(plan.allowed, false);
});

test('leverage adjustment never exceeds the recommended leverage', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision({ recommendedLeverage: 3 }));
  assert.ok(plan.leverage <= 3);
});

test('manageStopLoss combines break-even and trailing correctly over a profitable move', () => {
  const engine = new RiskEngine();
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision());
  const managed = engine.manageStopLoss({
    side: 'LONG',
    entryPrice: 65000,
    currentPrice: 68000,
    initialStopLoss: plan.stopLoss,
    currentStopLoss: plan.stopLoss,
    currentAtr: 500,
  });
  assert.ok(managed.stopLoss > plan.stopLoss);
  assert.equal(managed.isTrailing, true);
});

test('updateTradeStats enables Kelly-based sizing for a symbol', () => {
  const engine = new RiskEngine({ positionSizing: { method: 'kelly' } });
  engine.recordEquity(10000);
  // Modest edge chosen so the resulting Kelly size stays within the
  // default 15% max-symbol-exposure limit (a large edge would correctly
  // get rejected on exposure grounds — see the exposure-limit tests).
  engine.updateTradeStats('BTCUSDT', { winRate: 0.55, avgWinPct: 1.5, avgLossPct: 1, sampleSize: 50 });
  const plan = engine.evaluate(baseDecision());
  assert.equal(plan.allowed, true);
  assert.ok(plan.positionSize > 0);
});

test('a decision with insufficient risk:reward is rejected even if everything else is fine', () => {
  const engine = new RiskEngine({ takeProfit: { minRiskReward: 10 } }); // impossible to satisfy with default targets
  engine.recordEquity(10000);
  const plan = engine.evaluate(baseDecision());
  assert.equal(plan.allowed, false);
  assert.equal(plan.rejectReason, 'risk_reward_below_minimum');
});
