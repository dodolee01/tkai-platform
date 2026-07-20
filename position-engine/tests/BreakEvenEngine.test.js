import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBreakEven } from '../src/BreakEvenEngine.js';
import { createConfig } from '../src/Config.js';

test('riskMultiple method triggers exactly at the configured R threshold', () => {
  const config = createConfig({ breakEven: { method: 'riskMultiple', riskMultipleTrigger: 1.0 } }).breakEven;
  const below = evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 104.9, initialStopLoss: 95, currentStopLoss: 95, alreadyActivated: false }, config);
  const atThreshold = evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 105, initialStopLoss: 95, currentStopLoss: 95, alreadyActivated: false }, config);
  assert.equal(below.shouldActivate, false);
  assert.equal(atThreshold.shouldActivate, true);
});

test('already-activated positions never re-trigger (idempotency)', () => {
  const config = createConfig().breakEven;
  const result = evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 200, initialStopLoss: 95, currentStopLoss: 100.05, alreadyActivated: true }, config);
  assert.equal(result.shouldActivate, false);
});

test('fixedPct method compares against entry price percentage move', () => {
  const config = createConfig({ breakEven: { method: 'fixedPct', fixedPctTrigger: 0.02 } }).breakEven;
  const result = evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 102.5, initialStopLoss: 90, currentStopLoss: 90, alreadyActivated: false }, config);
  assert.equal(result.shouldActivate, true);
});

test('atrMultiple method requires currentAtr and throws without it', () => {
  const config = createConfig({ breakEven: { method: 'atrMultiple' } }).breakEven;
  assert.throws(() => evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 105, initialStopLoss: 95, currentStopLoss: 95, alreadyActivated: false }, config));
});

test('SHORT positions compute favorable movement in the opposite direction', () => {
  const config = createConfig({ breakEven: { method: 'riskMultiple', riskMultipleTrigger: 1.0 } }).breakEven;
  const result = evaluateBreakEven({ side: 'SHORT', entryPrice: 100, markPrice: 94, initialStopLoss: 105, currentStopLoss: 105, alreadyActivated: false }, config);
  assert.equal(result.shouldActivate, true);
  assert.ok(result.newStopLoss < 100);
});

test('new stop loss never moves backward relative to an already-better stop', () => {
  const config = createConfig({ breakEven: { offsetPct: 0.001 } }).breakEven;
  const result = evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 110, initialStopLoss: 95, currentStopLoss: 101, alreadyActivated: false }, config);
  assert.equal(result.newStopLoss, 101); // already better than entry+offset
});

test('unknown method throws a clear error', () => {
  const config = createConfig({ breakEven: { method: 'notARealMethod' } }).breakEven;
  assert.throws(() => evaluateBreakEven({ side: 'LONG', entryPrice: 100, markPrice: 105, initialStopLoss: 95, currentStopLoss: 95, alreadyActivated: false }, config), /unknown method/);
});
