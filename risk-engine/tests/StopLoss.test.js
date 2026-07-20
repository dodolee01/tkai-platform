import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAtrStopLoss, stopDistance, currentRMultiple, applyBreakEven, applyTrailingStop } from '../src/StopLoss.js';
import { createConfig } from '../src/Config.js';

test('computeAtrStopLoss places stop below entry for LONG, above for SHORT', () => {
  const config = createConfig().stopLoss;
  const longStop = computeAtrStopLoss({ side: 'LONG', entryPrice: 100, atr: 2 }, config);
  const shortStop = computeAtrStopLoss({ side: 'SHORT', entryPrice: 100, atr: 2 }, config);
  assert.ok(longStop < 100);
  assert.ok(shortStop > 100);
});

test('computeAtrStopLoss enforces the minimum stop distance floor', () => {
  const config = createConfig({ stopLoss: { atrMultiplier: 1, minStopDistancePct: 0.05 } }).stopLoss;
  const stop = computeAtrStopLoss({ side: 'LONG', entryPrice: 100, atr: 0.1 }, config); // ATR distance tiny
  assert.equal(stop, 95); // 5% floor wins
});

test('stopDistance is always positive regardless of side', () => {
  assert.equal(stopDistance('LONG', 100, 95), 5);
  assert.equal(stopDistance('SHORT', 100, 105), 5);
});

test('currentRMultiple computes profit in units of initial risk', () => {
  assert.equal(currentRMultiple('LONG', 100, 115, 90), 1.5);
  assert.equal(currentRMultiple('SHORT', 100, 85, 110), 1.5);
});

test('applyBreakEven only triggers at or after triggerRR', () => {
  const config = createConfig().stopLoss.breakEven;
  const before = applyBreakEven({ side: 'LONG', entryPrice: 100, currentPrice: 104, initialStopLoss: 95, currentStopLoss: 95 }, config); // 0.8R, below the 1.0R trigger
  const after = applyBreakEven({ side: 'LONG', entryPrice: 100, currentPrice: 106, initialStopLoss: 95, currentStopLoss: 95 }, config); // 1.2R, past the trigger
  assert.equal(before.movedToBreakEven, false);
  assert.equal(after.movedToBreakEven, true);
});

test('applyBreakEven never loosens an already-improved stop', () => {
  const config = createConfig().stopLoss.breakEven;
  const result = applyBreakEven({ side: 'LONG', entryPrice: 100, currentPrice: 110, initialStopLoss: 90, currentStopLoss: 108 }, config);
  assert.equal(result.stopLoss, 108);
});

test('applyTrailingStop only activates at or after activationRR', () => {
  const config = createConfig().stopLoss.trailing;
  const before = applyTrailingStop({ side: 'LONG', entryPrice: 100, currentPrice: 100.5, initialStopLoss: 95, currentStopLoss: 95, currentAtr: 2 }, config);
  assert.equal(before.isTrailing, false);
});

test('applyTrailingStop trails behind price once active and never loosens', () => {
  const config = createConfig().stopLoss.trailing;
  const active = applyTrailingStop({ side: 'LONG', entryPrice: 100, currentPrice: 120, initialStopLoss: 95, currentStopLoss: 95, currentAtr: 2 }, config);
  assert.equal(active.isTrailing, true);
  assert.equal(active.stopLoss, 120 - 2 * config.atrMultiplier);

  const noLoosen = applyTrailingStop({ side: 'LONG', entryPrice: 100, currentPrice: 110, initialStopLoss: 95, currentStopLoss: 118, currentAtr: 2 }, config);
  assert.equal(noLoosen.stopLoss, 118);
});
