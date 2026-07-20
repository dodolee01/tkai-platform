import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Supertrend } from '../../src/indicators/Supertrend.js';

test('Supertrend flips to up trend during a sustained rally', () => {
  const st = new Supertrend(3, 2);
  let last = null;
  for (let i = 0; i < 15; i++) {
    const price = 100 + i * 3;
    const v = st.update({ high: price + 1, low: price - 1, close: price });
    if (v !== null) last = v;
  }
  assert.equal(last.trend, 'up');
});

test('Supertrend flips to down trend during a sustained decline', () => {
  const st = new Supertrend(3, 2);
  let last = null;
  for (let i = 0; i < 15; i++) {
    const price = 200 - i * 3;
    const v = st.update({ high: price + 1, low: price - 1, close: price });
    if (v !== null) last = v;
  }
  assert.equal(last.trend, 'down');
});

test('Supertrend returns null until ATR warms up', () => {
  const st = new Supertrend(10, 3);
  assert.equal(st.update({ high: 10, low: 9, close: 9.5 }), null);
});
