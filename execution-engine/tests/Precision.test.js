import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/Precision.js';

test('roundToTickSize rounds down, never up', () => {
  assert.equal(P.roundToTickSize(65432.37, 0.1), 65432.3);
  assert.equal(P.roundToTickSize(65432.39, 0.1), 65432.3);
});

test('roundToStepSize rounds down to the correct decimal precision', () => {
  assert.equal(P.roundToStepSize(0.12399, 0.001), 0.123);
});

test('meetsMinNotional and computeNotional are consistent', () => {
  assert.equal(P.computeNotional(100, 2), 200);
  assert.equal(P.meetsMinNotional(100, 2, 200), true);
  assert.equal(P.meetsMinNotional(100, 2, 201), false);
});

test('withinQtyBounds respects both edges inclusively', () => {
  assert.equal(P.withinQtyBounds(1, 1, 10), true);
  assert.equal(P.withinQtyBounds(10, 1, 10), true);
  assert.equal(P.withinQtyBounds(10.01, 1, 10), false);
});

test('isAlignedToStep tolerates floating point noise but rejects real misalignment', () => {
  assert.equal(P.isAlignedToStep(0.3, 0.1), true);
  assert.equal(P.isAlignedToStep(0.35, 0.1), false);
});
