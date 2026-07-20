import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MACD } from '../../src/indicators/MACD.js';

test('MACD histogram equals macd minus signal', () => {
  const macd = new MACD(3, 6, 2);
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  let last = null;
  for (const c of closes) {
    const v = macd.update(c);
    if (v !== null) last = v;
  }
  assert.ok(last !== null);
  assert.ok(Math.abs(last.histogram - (last.macd - last.signal)) < 1e-9);
});

test('MACD returns null until the slow EMA warms up', () => {
  const macd = new MACD(3, 6, 2);
  assert.equal(macd.update(1), null);
  assert.equal(macd.update(1), null);
});

test('MACD.reset clears state so update() starts null again', () => {
  const macd = new MACD(3, 6, 2);
  for (let i = 1; i <= 10; i++) macd.update(i);
  assert.ok(macd.value !== null);
  macd.reset();
  assert.equal(macd.value, null);
  assert.equal(macd.update(1), null);
});
