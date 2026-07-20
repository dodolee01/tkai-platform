import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bollinger } from '../../src/indicators/Bollinger.js';

test('Bollinger bands collapse to the price for a flat series', () => {
  const bb = new Bollinger(4, 2);
  let last = null;
  for (let i = 0; i < 4; i++) last = bb.update(10);
  assert.equal(last.middle, 10);
  assert.equal(last.upper, 10);
  assert.equal(last.lower, 10);
  assert.equal(last.bandwidth, 0);
});

test('Bollinger upper band is always >= middle >= lower', () => {
  const bb = new Bollinger(5, 2);
  const closes = [10, 12, 9, 15, 11, 20, 8];
  for (const c of closes) {
    const v = bb.update(c);
    if (v !== null) {
      assert.ok(v.upper >= v.middle);
      assert.ok(v.middle >= v.lower);
    }
  }
});
