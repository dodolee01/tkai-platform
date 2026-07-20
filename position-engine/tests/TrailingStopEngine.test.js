import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTrailingStop } from '../src/TrailingStopEngine.js';
import { createConfig } from '../src/Config.js';

test('trailing does not activate before the configured activationRR', () => {
  const config = createConfig({ trailing: { method: 'percentage', activationRR: 2.0 } }).trailing;
  const result = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 105, initialStopLoss: 95, currentStopLoss: 95 }, config); // risk=5, profit=5, rMultiple=1.0 < 2.0
  assert.equal(result.isTrailing, false);
});

test('percentage trailing computes the correct stop distance once active', () => {
  const config = createConfig({ trailing: { method: 'percentage', percentageDistance: 0.02, activationRR: 1.0 } }).trailing;
  const result = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 150, initialStopLoss: 95, currentStopLoss: 95 }, config);
  assert.equal(result.stopLoss, 150 * 0.98);
});

test('a trailing stop never loosens, even if the candidate would be worse', () => {
  const config = createConfig({ trailing: { method: 'percentage', percentageDistance: 0.05, activationRR: 1.0 } }).trailing;
  const result = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 110, initialStopLoss: 95, currentStopLoss: 108 }, config);
  assert.equal(result.stopLoss, 108);
});

test('ATR trailing requires currentAtr and computes correctly', () => {
  const config = createConfig({ trailing: { method: 'atr', atrMultiple: 3, activationRR: 1.0 } }).trailing;
  assert.throws(() => evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 150, initialStopLoss: 95, currentStopLoss: 95 }, config));
  const result = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 150, initialStopLoss: 95, currentStopLoss: 95, currentAtr: 4 }, config);
  assert.equal(result.stopLoss, 150 - 4 * 3);
});

test('step trailing only moves once the step trigger threshold is met', () => {
  const config = createConfig({ trailing: { method: 'step', stepTriggerPct: 0.05, stepSizePct: 0.01, activationRR: 1.0 } }).trailing;
  const noStep = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 200, initialStopLoss: 95, currentStopLoss: 95, lastStepPrice: 199 }, config);
  assert.equal(noStep.stepped, false);
  const stepped = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 220, initialStopLoss: 95, currentStopLoss: 95, lastStepPrice: 199 }, config);
  assert.equal(stepped.stepped, true);
  assert.equal(stepped.lastStepPrice, 220);
});

test('dynamic trailing widens the stop distance under high volatility', () => {
  const config = createConfig({ trailing: { method: 'dynamic', dynamicVolatilityThreshold: 0.03, dynamicLowVolMultiple: 1, dynamicHighVolMultiple: 4, activationRR: 1.0 } }).trailing;
  const low = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 150, initialStopLoss: 95, currentStopLoss: 95, currentAtr: 5, volatility: 0.01 }, config);
  const high = evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 150, initialStopLoss: 95, currentStopLoss: 95, currentAtr: 5, volatility: 0.05 }, config);
  assert.ok(150 - high.stopLoss > 150 - low.stopLoss);
});

test('SHORT positions trail correctly above the price', () => {
  const config = createConfig({ trailing: { method: 'percentage', percentageDistance: 0.02, activationRR: 1.0 } }).trailing;
  const result = evaluateTrailingStop({ side: 'SHORT', entryPrice: 100, markPrice: 80, initialStopLoss: 105, currentStopLoss: 105 }, config);
  assert.equal(result.stopLoss, 80 * 1.02);
});

test('unknown method throws a clear error', () => {
  const config = createConfig({ trailing: { method: 'notReal', activationRR: 0 } }).trailing;
  assert.throws(() => evaluateTrailingStop({ side: 'LONG', entryPrice: 100, markPrice: 110, initialStopLoss: 95, currentStopLoss: 95 }, config), /unknown method/);
});
