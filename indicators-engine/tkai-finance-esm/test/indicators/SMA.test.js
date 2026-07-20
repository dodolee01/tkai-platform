import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SMA } from '../../src/indicators/SMA.js';

test('SMA of a constant series equals the constant', () => {
  const sma = new SMA(4);
  sma.update(10);
  sma.update(10);
  sma.update(10);
  const value = sma.update(10);
  assert.equal(value, 10);
});

test('SMA computes correct rolling average', () => {
  const sma = new SMA(3);
  sma.update(1);
  sma.update(2);
  const v1 = sma.update(3); // avg(1,2,3) = 2
  assert.equal(v1, 2);
  const v2 = sma.update(6); // avg(2,3,6) = 3.6666...
  assert.ok(Math.abs(v2 - 3.6666666666666665) < 1e-9);
});

test('SMA returns null before window fills', () => {
  const sma = new SMA(5);
  assert.equal(sma.update(1), null);
  assert.equal(sma.update(2), null);
});

test('SMA.value getter matches last update()', () => {
  const sma = new SMA(2);
  sma.update(4);
  const last = sma.update(6);
  assert.equal(sma.value, last);
});
