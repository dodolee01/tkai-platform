import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stochastic } from '../../src/indicators/Stochastic.js';

test('Stochastic %K is 100 when close equals the period high', () => {
  const st = new Stochastic(3, 1, 1); // no extra smoothing for a direct check
  st.update({ high: 10, low: 5, close: 7 });
  st.update({ high: 12, low: 6, close: 8 });
  const v = st.update({ high: 15, low: 7, close: 15 }); // close == highest high
  assert.equal(v.k, 100);
});

test('Stochastic %K is 0 when close equals the period low', () => {
  const st = new Stochastic(3, 1, 1);
  st.update({ high: 10, low: 5, close: 7 });
  st.update({ high: 12, low: 6, close: 8 });
  const v = st.update({ high: 15, low: 3, close: 3 }); // close == lowest low
  assert.equal(v.k, 0);
});
