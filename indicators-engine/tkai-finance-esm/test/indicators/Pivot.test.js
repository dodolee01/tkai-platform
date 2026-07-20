import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pivot } from '../../src/indicators/Pivot.js';

test('standard Pivot Point formula matches manual calculation', () => {
  const pivot = new Pivot({ method: 'standard' });
  const v = pivot.update({ high: 12, low: 8, close: 10 });
  const expectedPP = (12 + 8 + 10) / 3;
  assert.ok(Math.abs(v.pp - expectedPP) < 1e-9);
  assert.equal(v.r1, 2 * expectedPP - 8);
  assert.equal(v.s1, 2 * expectedPP - 12);
});

test('fibonacci Pivot levels are symmetric around pp', () => {
  const pivot = new Pivot({ method: 'fibonacci' });
  const v = pivot.update({ high: 110, low: 90, close: 100 });
  assert.ok(Math.abs((v.r1 - v.pp) - (v.pp - v.s1)) < 1e-9);
});
