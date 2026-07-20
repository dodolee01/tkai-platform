import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WilliamsR } from '../../src/indicators/WilliamsR.js';

test('Williams %R is 0 when close equals the period high', () => {
  const wr = new WilliamsR(3);
  wr.update({ high: 10, low: 5, close: 7 });
  wr.update({ high: 12, low: 6, close: 8 });
  const v = wr.update({ high: 15, low: 7, close: 15 });
  assert.equal(v, 0);
});

test('Williams %R is -100 when close equals the period low', () => {
  const wr = new WilliamsR(3);
  wr.update({ high: 10, low: 5, close: 7 });
  wr.update({ high: 12, low: 6, close: 8 });
  const v = wr.update({ high: 15, low: 3, close: 3 });
  assert.equal(v, -100);
});
