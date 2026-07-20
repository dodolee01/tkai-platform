import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RSI } from '../../src/indicators/RSI.js';

test('RSI is 100 when there are no losses', () => {
  const rsi = new RSI(3);
  const closes = [1, 2, 3, 4, 5]; // strictly increasing
  let last = null;
  for (const c of closes) last = rsi.update(c);
  assert.equal(last, 100);
});

test('RSI is 0 when there are no gains', () => {
  const rsi = new RSI(3);
  const closes = [5, 4, 3, 2, 1]; // strictly decreasing
  let last = null;
  for (const c of closes) last = rsi.update(c);
  assert.equal(last, 0);
});

test('RSI stays within [0, 100] for mixed data', () => {
  const rsi = new RSI(14);
  const closes = [100, 102, 101, 105, 103, 107, 104, 110, 108, 112, 109, 115, 111, 118, 116, 120];
  for (const c of closes) {
    const v = rsi.update(c);
    if (v !== null) {
      assert.ok(v >= 0 && v <= 100);
    }
  }
});

test('RSI returns null until warmed up', () => {
  const rsi = new RSI(14);
  assert.equal(rsi.update(1), null); // first call always null (needs prevClose)
});
