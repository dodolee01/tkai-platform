import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executePartialClose, executePresetPartialClose, PRESET_FRACTIONS } from '../src/PartialCloseEngine.js';

const baseInput = { side: 'LONG', averageEntryPrice: 100, remainingQuantity: 10, closePrice: 110, leverage: 5 };

test('a 25% close reduces quantity and realizes PnL proportionally', () => {
  const result = executePartialClose(baseInput, 0.25);
  assert.equal(result.closedQuantity, 2.5);
  assert.equal(result.remainingQuantity, 7.5);
  assert.equal(result.realizedPnl, 10 * 2.5);
  assert.equal(result.isFullyClosed, false);
});

test('a 100% close leaves zero remaining and marks isFullyClosed', () => {
  const result = executePartialClose(baseInput, 1.0);
  assert.equal(result.remainingQuantity, 0);
  assert.equal(result.isFullyClosed, true);
});

test('average entry price is unaffected by a partial close', () => {
  // Not directly returned, but verify realizedPnl uses the SAME entry for any fraction
  const r1 = executePartialClose(baseInput, 0.1);
  const r2 = executePartialClose(baseInput, 0.9);
  assert.equal(r1.realizedPnl / r1.closedQuantity, r2.realizedPnl / r2.closedQuantity);
});

test('fraction outside (0, 1] throws', () => {
  assert.throws(() => executePartialClose(baseInput, 0));
  assert.throws(() => executePartialClose(baseInput, 1.01));
  assert.throws(() => executePartialClose(baseInput, -0.5));
});

test('preset percentages match their equivalent fraction exactly', () => {
  for (const pct of [10, 25, 50, 75]) {
    const preset = executePresetPartialClose(baseInput, pct);
    const manual = executePartialClose(baseInput, pct / 100);
    assert.deepEqual(preset, manual);
  }
});

test('an invalid preset percentage throws', () => {
  assert.throws(() => executePresetPartialClose(baseInput, 33));
});

test('PRESET_FRACTIONS exposes the four standard fractions in order', () => {
  assert.deepEqual(PRESET_FRACTIONS, [0.1, 0.25, 0.5, 0.75]);
});

test('SHORT positions realize PnL in the correct direction', () => {
  const shortInput = { side: 'SHORT', averageEntryPrice: 100, remainingQuantity: 10, closePrice: 90, leverage: 5 };
  const result = executePartialClose(shortInput, 0.5);
  assert.equal(result.realizedPnl, 10 * 5); // profit on a SHORT when price falls
});
